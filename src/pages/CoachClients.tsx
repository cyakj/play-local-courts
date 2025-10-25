import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Mail, Phone, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function CoachClients() {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientNotes, setClientNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, [currentUser]);

  const loadClients = async () => {
    if (!currentUser) return;

    try {
      // Get unique clients from lesson requests
      const { data: lessonData, error } = await supabase
        .from('lesson_requests')
        .select(`
          player_id,
          player:profiles!lesson_requests_player_id_fkey (
            id,
            full_name,
            avatar_url,
            phone_number
          )
        `)
        .eq('coach_id', currentUser.id)
        .eq('status', 'accepted');

      if (error) throw error;

      // Deduplicate clients
      const uniqueClients = Array.from(
        new Map(
          lessonData?.map((item) => [item.player_id, item.player])
        ).values()
      );

      setClients(uniqueClients as any[]);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const loadClientNotes = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_notes')
        .select('notes')
        .eq('coach_id', currentUser?.id)
        .eq('client_id', clientId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setClientNotes(data?.notes || '');
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const saveClientNotes = async (clientId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('client_notes')
        .upsert({
          coach_id: currentUser.id,
          client_id: clientId,
          notes: clientNotes,
        });

      if (error) throw error;
      toast.success('Notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  if (loading) {
    return <div className="p-6">Loading clients...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          My Clients
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your students and track their progress
        </p>
      </div>

      <div className="grid gap-4">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No clients yet. Accept lesson requests to build your client list.
              </p>
            </CardContent>
          </Card>
        ) : (
          clients.map((client) => (
            <Card key={client?.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={client?.avatar_url} />
                      <AvatarFallback>
                        {client?.full_name?.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">{client?.full_name}</h3>
                      {client?.phone_number && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {client.phone_number}
                        </div>
                      )}
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client);
                          loadClientNotes(client.id);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Notes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Client Notes - {client?.full_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Add notes about this client..."
                          value={clientNotes}
                          onChange={(e) => setClientNotes(e.target.value)}
                          rows={8}
                        />
                        <Button
                          onClick={() => saveClientNotes(client.id)}
                          className="w-full"
                        >
                          Save Notes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
