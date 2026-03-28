import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  Search,
  ArrowLeft,
  User,
  Check,
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';
import { ProfileLink } from '@/components/ui/profile-link';
import LadderInvitationMessage, { isLadderInvitation } from '@/components/messages/LadderInvitationMessage';

interface Conversation {
  id: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read_at: string | null;
}

export default function Messages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get('user'));
  const [selectedUser, setSelectedUser] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);

  const selectedUserIdRef = useRef(selectedUserId);
  selectedUserIdRef.current = selectedUserId;

  const handleRealtimeMessage = useCallback(() => {
    loadConversations();
    // Also reload the active thread so new messages appear instantly
    if (selectedUserIdRef.current) {
      loadMessages(selectedUserIdRef.current);
    }
  }, [currentUser]);

  useRealtimeSubscription({
    table: 'messages',
    event: '*',
    onChange: handleRealtimeMessage,
    enabled: !!currentUser
  });

  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
      loadSelectedUser(selectedUserId);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!currentUser) return;

    try {
      // Get all messages involving current user
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by conversation partner
      const conversationMap = new Map<string, { messages: Message[]; unread: number }>();
      
      messagesData?.forEach((msg) => {
        const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, { messages: [], unread: 0 });
        }
        
        const conv = conversationMap.get(partnerId)!;
        conv.messages.push(msg);
        
        if (msg.receiver_id === currentUser.id && !msg.read_at) {
          conv.unread++;
        }
      });

      // Get profile info for each conversation partner
      const partnerIds = Array.from(conversationMap.keys());
      
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', partnerIds);

        const conversationsList: Conversation[] = partnerIds.map((partnerId) => {
          const conv = conversationMap.get(partnerId)!;
          const profile = profiles?.find((p) => p.id === partnerId);
          const lastMsg = conv.messages[0];

          return {
            id: partnerId,
            full_name: profile?.full_name || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            last_message: lastMsg?.content || '',
            last_message_time: lastMsg?.created_at || '',
            unread_count: conv.unread
          };
        });

        // Sort by most recent activity
        conversationsList.sort((a, b) => 
          new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
        );

        setConversations(conversationsList);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setSelectedUser(data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadMessages = async (userId: string) => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Check for unread messages to determine scroll behavior
      const firstUnreadIdx = (data || []).findIndex(
        (m) => m.sender_id === userId && !m.read_at
      );
      
      if (firstUnreadIdx > 0) {
        shouldScrollToBottomRef.current = false;
        setMessages(data || []);
        setTimeout(() => {
          const el = document.getElementById('msg-new-divider');
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      } else {
        shouldScrollToBottomRef.current = true;
        setMessages(data || []);
      }

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', userId)
        .eq('receiver_id', currentUser.id)
        .is('read_at', null);

      // Refresh conversations to update unread count
      loadConversations();
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!currentUser || !selectedUserId || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedUserId,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      loadMessages(selectedUserId);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div>Loading messages...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
          <MessageCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          {totalUnread > 0 && (
            <p className="text-sm text-muted-foreground">{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Conversations List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedUserId(conv.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors border-b",
                      selectedUserId === conv.id && "bg-accent"
                    )}
                  >
                    <Avatar>
                      <AvatarImage src={conv.avatar_url || undefined} />
                      <AvatarFallback>
                        {conv.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <ProfileLink userId={conv.id} className="font-medium truncate" showTooltip={false}>
                          {conv.full_name}
                        </ProfileLink>
                        <span className="text-xs text-muted-foreground">
                          {formatMessageTime(conv.last_message_time)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {isLadderInvitation(conv.last_message) ? '📨 Ladder partnership invitation' : conv.last_message}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <Badge className="bg-primary text-primary-foreground h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedUserId && selectedUser ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="lg:hidden"
                    onClick={() => setSelectedUserId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <ProfileLink userId={selectedUserId} showTooltip={false}>
                    <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                      <AvatarImage src={selectedUser.avatar_url || undefined} />
                      <AvatarFallback>
                        {selectedUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </ProfileLink>
                  <div className="flex-1">
                    <h3 className="font-medium">
                      <ProfileLink userId={selectedUserId}>
                        {selectedUser.full_name}
                      </ProfileLink>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Click name to view profile
                    </p>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {(() => {
                      const firstUnreadIdx = messages.findIndex(
                        (m) => m.sender_id === selectedUserId && !m.read_at
                      );

                      return messages.map((msg, idx) => {
                        const isOwn = msg.sender_id === currentUser?.id;
                        const invitationData = isLadderInvitation(msg.content);
                        const showNewDivider = idx === firstUnreadIdx && firstUnreadIdx > 0;

                        return (
                          <React.Fragment key={msg.id}>
                            {showNewDivider && (
                              <div id="msg-new-divider" className="flex items-center gap-3 py-1">
                                <div className="flex-1 h-px bg-primary/40" />
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">New</span>
                                <div className="flex-1 h-px bg-primary/40" />
                              </div>
                            )}

                            {invitationData && !isOwn ? (
                              <div className="flex justify-start">
                                <div className="max-w-[85%]">
                                  <LadderInvitationMessage
                                    invitationData={invitationData}
                                    messageId={msg.id}
                                    senderId={msg.sender_id}
                                    onStatusChange={() => loadMessages(selectedUserId!)}
                                  />
                                  <div className="text-xs text-muted-foreground mt-1 ml-1">
                                    {formatMessageTime(msg.created_at)}
                                  </div>
                                </div>
                              </div>
                            ) : invitationData && isOwn ? (
                              <div className="flex justify-end">
                                <div className="max-w-[70%] rounded-lg px-4 py-2 bg-primary/80 text-primary-foreground">
                                  <p className="text-sm">
                                    📨 You sent a ladder partnership invitation for <strong>{invitationData.ladder_name}</strong>
                                  </p>
                                  <div className="flex items-center gap-1 mt-1 text-xs text-primary-foreground/70">
                                    <span>{formatMessageTime(msg.created_at)}</span>
                                    {msg.read_at 
                                      ? <CheckCheck className="h-3 w-3" />
                                      : <Check className="h-3 w-3" />
                                    }
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                  "max-w-[70%] rounded-lg px-4 py-2",
                                  isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                                )}>
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                  <div className={cn(
                                    "flex items-center gap-1 mt-1 text-xs",
                                    isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                                  )}>
                                    <span>{formatMessageTime(msg.created_at)}</span>
                                    {isOwn && (
                                      msg.read_at 
                                        ? <CheckCheck className="h-3 w-3" />
                                        : <Check className="h-3 w-3" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={sending}
                  />
                  <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the list to start messaging</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
