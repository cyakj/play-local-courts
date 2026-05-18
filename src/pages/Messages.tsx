import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';
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

// ── Tiny inline SVGs ─────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
);

const ChatBubbleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

interface ResidentProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function Messages() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { currentUser } = useAuth();
  const isCMContext = location.pathname === '/cm/messages';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get('user'));
  const [selectedUser, setSelectedUser] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [residents, setResidents] = useState<ResidentProfile[]>([]);
  const [residentSearch, setResidentSearch] = useState('');
  const [loadingResidents, setLoadingResidents] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUserIdRef = useRef(selectedUserId);
  selectedUserIdRef.current = selectedUserId;

  const handleRealtimeMessage = useCallback(() => {
    loadConversations();
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
    if (currentUser) loadConversations();
  }, [currentUser]);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
      loadSelectedUser(selectedUserId);
    } else {
      setSelectedUser(null);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!currentUser) return;
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversationMap = new Map<string, { messages: Message[]; unread: number }>();
      messagesData?.forEach((msg) => {
        const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, { messages: [], unread: 0 });
        }
        const conv = conversationMap.get(partnerId)!;
        conv.messages.push(msg);
        if (msg.receiver_id === currentUser.id && !msg.read_at) conv.unread++;
      });

      const partnerIds = Array.from(conversationMap.keys());
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', partnerIds);

        const list: Conversation[] = partnerIds.map((partnerId) => {
          const conv = conversationMap.get(partnerId)!;
          const profile = profiles?.find((p) => p.id === partnerId);
          const lastMsg = conv.messages[0];
          return {
            id: partnerId,
            full_name: profile?.full_name || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            last_message: lastMsg?.content || '',
            last_message_time: lastMsg?.created_at || '',
            unread_count: conv.unread,
          };
        });

        list.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
        setConversations(list);
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
      setSelectedUser({ id: userId, full_name: 'Unknown User', avatar_url: null });
    }
  };

  const loadResidents = async () => {
    if (!currentUser?.id) return;
    setLoadingResidents(true);
    try {
      const { data: memberships } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'approved');

      const hoaIds = [...new Set((memberships || []).map((m: any) => m.hoa_id))];
      if (hoaIds.length === 0) { setLoadingResidents(false); return; }

      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .in('hoa_id', hoaIds)
        .eq('status', 'approved')
        .neq('user_id', currentUser.id);

      const residentIds = [...new Set((members || []).map((m: any) => m.user_id))];
      if (residentIds.length === 0) { setResidents([]); setLoadingResidents(false); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', residentIds);

      const sortedProfiles = ((profiles || []) as ResidentProfile[])
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setResidents(sortedProfiles);
    } catch (err) {
      console.error('Error loading residents:', err);
    } finally {
      setLoadingResidents(false);
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

      const firstUnreadIdx = (data || []).findIndex((m) => m.sender_id === userId && !m.read_at);
      if (firstUnreadIdx > 0) {
        shouldScrollToBottomRef.current = false;
        setMessages(data || []);
        setTimeout(() => {
          document.getElementById('msg-new-divider')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      } else {
        shouldScrollToBottomRef.current = true;
        setMessages(data || []);
      }

      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', userId)
        .eq('receiver_id', currentUser.id)
        .is('read_at', null);

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
        .insert({ sender_id: currentUser.id, receiver_id: selectedUserId, content: newMessage.trim() });
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
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredConversations = conversations.filter((conv) =>
    conv.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  // ── CHAT VIEW (full-screen overlay when conversation selected) ──────────────
  if (selectedUserId) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: '#F9FAFB' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{
            background: '#0F1F3D',
            paddingTop: 'max(48px, calc(env(safe-area-inset-top) + 12px))',
            paddingBottom: 16,
          }}
        >
          <button
            onClick={() => setSelectedUserId(null)}
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer' }}
            aria-label="Back"
          >
            <ChevronLeftIcon />
          </button>

          {/* Avatar */}
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              width: 40, height: 40,
              background: 'rgba(0,212,255,0.2)',
              border: '2px solid rgba(0,212,255,0.5)',
              overflow: 'hidden',
            }}
          >
            {selectedUser?.avatar_url ? (
              <img src={selectedUser.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-[13px] font-bold" style={{ color: '#00D4FF' }}>
                {selectedUser ? getInitials(selectedUser.full_name) : '…'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate" style={{ fontSize: 16, fontFamily: 'Manrope, sans-serif' }}>
              {selectedUser?.full_name || 'Loading…'}
            </div>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif' }}>
              Community member
            </div>
          </div>
        </div>

        {/* Messages — scrollable */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
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
                    <div id="msg-new-divider" className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px" style={{ background: 'rgba(0,212,255,0.3)' }} />
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#00D4FF' }}>New</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(0,212,255,0.3)' }} />
                    </div>
                  )}

                  {invitationData && !isOwn ? (
                    <div className="flex justify-start mb-1">
                      <div style={{ maxWidth: '85%' }}>
                        <LadderInvitationMessage
                          invitationData={invitationData}
                          messageId={msg.id}
                          senderId={msg.sender_id}
                          onStatusChange={() => loadMessages(selectedUserId!)}
                        />
                        <div className="text-[10px] mt-1 ml-1" style={{ color: '#8892A4' }}>
                          {formatMessageTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ) : invitationData && isOwn ? (
                    <div className="flex justify-end mb-1">
                      <div style={{ maxWidth: '72%', background: '#0F1F3D', borderRadius: '14px 14px 4px 14px', padding: '10px 14px' }}>
                        <p className="text-sm text-white">
                          You sent a ladder partnership invitation for <strong>{invitationData.ladder_name}</strong>
                        </p>
                        <div className="flex items-center gap-1 mt-1" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {msg.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={cn('flex mb-1', isOwn ? 'justify-end' : 'justify-start')}>
                      <div
                        style={{
                          maxWidth: '72%',
                          background: isOwn ? '#0F1F3D' : '#FFFFFF',
                          color: isOwn ? '#FFFFFF' : '#0F1F3D',
                          borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          padding: '10px 14px',
                          border: isOwn ? 'none' : '1px solid rgba(15,31,61,0.08)',
                          boxShadow: isOwn ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        <p className="text-[14px] whitespace-pre-wrap" style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                          {msg.content}
                        </p>
                        <div className="flex items-center gap-1 mt-1" style={{ color: isOwn ? 'rgba(255,255,255,0.5)' : '#8892A4', fontSize: 10 }}>
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {isOwn && (msg.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
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

        {/* Input bar — fixed to bottom of overlay */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4"
          style={{
            background: 'white',
            borderTop: '1px solid rgba(15,31,61,0.08)',
            paddingTop: 12,
            paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))',
          }}
        >
          <input
            ref={inputRef}
            placeholder="Type a message…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sending}
            style={{
              flex: 1,
              background: '#F9FAFB',
              border: '1px solid rgba(15,31,61,0.12)',
              borderRadius: 24,
              padding: '12px 16px',
              fontSize: 15,
              fontFamily: 'Inter, sans-serif',
              color: '#0F1F3D',
              outline: 'none',
              minHeight: 48,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              background: newMessage.trim() && !sending ? '#0F1F3D' : '#E5E7EB',
              border: 'none',
              cursor: newMessage.trim() && !sending ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    );
  }

  const filteredResidents = residents.filter(r =>
    r.full_name?.toLowerCase().includes(residentSearch.toLowerCase())
  );

  // ── COMPOSE MODAL (CM only) ────────────────────────────────────────────────
  if (showCompose) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F9FAFB' }}>
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{
            background: '#0F1F3D',
            paddingTop: 'max(48px, calc(env(safe-area-inset-top) + 12px))',
            paddingBottom: 16,
          }}
        >
          <button
            onClick={() => { setShowCompose(false); setResidentSearch(''); }}
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeftIcon />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white" style={{ fontSize: 16, fontFamily: 'Manrope, sans-serif' }}>New Message</div>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Select a resident</div>
          </div>
        </div>
        <div className="px-4 pt-3 pb-2 bg-white border-b" style={{ borderColor: 'rgba(15,31,61,0.08)' }}>
          <input
            autoFocus
            placeholder="Search residents…"
            value={residentSearch}
            onChange={e => setResidentSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#F9FAFB',
              border: '1px solid rgba(15,31,61,0.12)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              color: '#0F1F3D',
              outline: 'none',
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingResidents ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
            </div>
          ) : filteredResidents.length === 0 ? (
            <div className="text-center py-16 px-8">
              <p className="font-bold text-[15px]" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                {residentSearch ? 'No residents found' : 'No residents in your communities'}
              </p>
            </div>
          ) : (
            filteredResidents.map(resident => (
              <div
                key={resident.id}
                onClick={() => {
                  setShowCompose(false);
                  setResidentSearch('');
                  setSelectedUserId(resident.id);
                }}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer border-b active:bg-gray-50"
                style={{ borderColor: 'rgba(15,31,61,0.06)', background: 'white' }}
              >
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ width: 44, height: 44, background: '#0F1F3D', overflow: 'hidden' }}
                >
                  {resident.avatar_url ? (
                    <img src={resident.avatar_url} className="w-full h-full object-cover" alt={resident.full_name} />
                  ) : (
                    <span className="text-[13px] font-bold text-white">{getInitials(resident.full_name || '')}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-[14px] truncate block" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                    {resident.full_name}
                  </span>
                  <span className="text-[12px]" style={{ color: '#8892A4' }}>Resident</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── CONVERSATION LIST VIEW ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-5 relative overflow-visible">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[13px] uppercase font-semibold" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
            Inbox
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <div style={{ background: '#F97066', color: 'white', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {totalUnread} new
              </div>
            )}
            {isCMContext && (
              <button
                onClick={() => { setShowCompose(true); loadResidents(); }}
                className="flex items-center justify-center rounded-xl"
                style={{ width: 36, height: 36, background: 'rgba(0,212,255,0.18)', border: '1.5px solid rgba(0,212,255,0.4)', cursor: 'pointer' }}
                aria-label="New message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        <h1 className="text-[28px] font-black text-white leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Messages
        </h1>

        {/* Search */}
        <div className="relative mt-4">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon />
          </div>
          <input
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '10px 12px 10px 36px',
              color: 'white',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="absolute -bottom-5 left-0 right-0 h-6 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }} />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto pb-28 mt-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-16 px-8">
            <div style={{ margin: '0 auto 12px', width: 48, height: 48 }}>
              <ChatBubbleIcon />
            </div>
            <p className="font-bold text-[15px]" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
              {searchQuery ? 'No results' : 'No conversations yet'}
            </p>
            <p className="text-[13px] mt-1" style={{ color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
              {searchQuery
                ? 'Try a different name.'
                : isCMContext
                  ? 'Tap + to message a resident.'
                  : "Start a conversation from a community member's profile."}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedUserId(conv.id)}
              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer border-b active:bg-gray-50"
              style={{ borderColor: 'rgba(15,31,61,0.06)', background: 'white' }}
            >
              {/* Avatar */}
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: 44, height: 44,
                  background: '#0F1F3D',
                  overflow: 'hidden',
                }}
              >
                {conv.avatar_url ? (
                  <img src={conv.avatar_url} className="w-full h-full object-cover" alt={conv.full_name} />
                ) : (
                  <span className="text-[13px] font-bold text-white">{getInitials(conv.full_name)}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-[14px] truncate" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                    {conv.full_name}
                  </span>
                  <span className="text-[11px] ml-2 flex-shrink-0" style={{ color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
                    {formatMessageTime(conv.last_message_time)}
                  </span>
                </div>
                <p className="text-[13px] truncate" style={{ color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
                  {isLadderInvitation(conv.last_message)
                    ? 'Ladder partnership invitation'
                    : conv.last_message}
                </p>
              </div>

              {conv.unread_count > 0 && (
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0 ml-1"
                  style={{ width: 20, height: 20, background: '#00D4FF', minWidth: 20 }}
                >
                  <span className="text-[10px] font-bold text-white">{conv.unread_count}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
