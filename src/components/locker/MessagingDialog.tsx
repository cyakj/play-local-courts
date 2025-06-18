
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface MessagingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MessagingDialog = ({ open, onOpenChange }: MessagingDialogProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadPlayers();
    }
  }, [open]);

  useEffect(() => {
    if (selectedPlayer) {
      loadMessages();
    }
  }, [selectedPlayer]);

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', currentUser?.id)
        .not('full_name', 'is', null);

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: "Error",
        description: "Failed to load players",
        variant: "destructive"
      });
    }
  };

  const loadMessages = async () => {
    if (!selectedPlayer || !currentUser) return;

    try {
      // First get the messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedPlayer.id}),and(sender_id.eq.${selectedPlayer.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Then get sender profiles for each message
      const messagesWithSender = await Promise.all(
        (messagesData || []).map(async (message) => {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', message.sender_id)
            .single();

          return {
            ...message,
            sender: senderProfile || { full_name: 'Unknown User', avatar_url: null }
          };
        })
      );

      setMessages(messagesWithSender);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPlayer || !currentUser) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedPlayer.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      loadMessages();
      
      toast({
        title: "Message sent",
        description: `Message sent to ${selectedPlayer.full_name}`
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedPlayer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPlayer(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selectedPlayer ? `Chat with ${selectedPlayer.full_name}` : 'Messages'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {!selectedPlayer ? (
            // Player List View
            <div className="w-full flex flex-col">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {filteredPlayers.map((player) => (
                    <Card 
                      key={player.id} 
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <CardContent className="flex items-center p-4">
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarImage src={player.avatar_url} />
                          <AvatarFallback>
                            {player.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{player.full_name}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            // Chat View
            <div className="w-full flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender_id === currentUser?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="resize-none"
                  rows={2}
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim() || loading}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessagingDialog;
