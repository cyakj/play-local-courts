import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Search,
  UserX,
  Calendar,
  Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ProfileLink } from '@/components/ui/profile-link';

interface ClientData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  utr_rating: number | null;
  wtn_rating: number | null;
  usta_ranking: string | null;
  lessonCount: number;
  mostRecentLesson: string | null;
  status: 'active' | 'past';
}

interface ClientNote {
  id: string;
  notes: string | null;
  is_hidden: boolean;
}

export default function CoachClients() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [clientNotes, setClientNotes] = useState<Record<string, ClientNote>>({});
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadClients();
    }
  }, [currentUser]);

  const loadClients = async () => {
    if (!currentUser) return;

    try {
      // Get all lesson requests (accepted or completed) for this coach
      const { data: lessonData, error: lessonError } = await supabase
        .from('lesson_requests')
        .select('player_id, preferred_date, status')
        .eq('coach_id', currentUser.id)
        .in('status', ['accepted', 'completed']);

      if (lessonError) throw lessonError;

      if (!lessonData || lessonData.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      // Aggregate lesson data per player
      const playerStats: Record<string, { count: number; mostRecent: string | null; hasRecent: boolean }> = {};
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      lessonData.forEach((lesson) => {
        const playerId = lesson.player_id;
        if (!playerStats[playerId]) {
          playerStats[playerId] = { count: 0, mostRecent: null, hasRecent: false };
        }
        playerStats[playerId].count++;
        
        const lessonDate = lesson.preferred_date;
        if (!playerStats[playerId].mostRecent || lessonDate > playerStats[playerId].mostRecent!) {
          playerStats[playerId].mostRecent = lessonDate;
        }
        
        if (new Date(lessonDate) >= thirtyDaysAgo) {
          playerStats[playerId].hasRecent = true;
        }
      });

      const playerIds = Object.keys(playerStats);

      // Get client notes to check for hidden clients
      const { data: notesData, error: notesError } = await supabase
        .from('client_notes')
        .select('client_id, id, notes, is_hidden')
        .eq('coach_id', currentUser.id)
        .in('client_id', playerIds);

      if (notesError) throw notesError;

      // Build notes map and filter out hidden clients
      const notesMap: Record<string, ClientNote> = {};
      const hiddenClientIds = new Set<string>();
      
      notesData?.forEach((note) => {
        notesMap[note.client_id] = {
          id: note.id,
          notes: note.notes,
          is_hidden: note.is_hidden || false
        };
        if (note.is_hidden) {
          hiddenClientIds.add(note.client_id);
        }
      });

      setClientNotes(notesMap);

      // Filter out hidden clients
      const visiblePlayerIds = playerIds.filter(id => !hiddenClientIds.has(id));

      if (visiblePlayerIds.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      // Fetch player profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone_number, utr_rating, wtn_rating, usta_ranking')
        .in('id', visiblePlayerIds);

      if (profilesError) throw profilesError;

      // Build client data
      const clientList: ClientData[] = (profilesData || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name || 'Unknown Player',
        avatar_url: profile.avatar_url,
        phone_number: profile.phone_number,
        utr_rating: profile.utr_rating,
        wtn_rating: profile.wtn_rating,
        usta_ranking: profile.usta_ranking,
        lessonCount: playerStats[profile.id]?.count || 0,
        mostRecentLesson: playerStats[profile.id]?.mostRecent || null,
        status: playerStats[profile.id]?.hasRecent ? 'active' : 'past'
      }));

      // Sort by most recent lesson (descending)
      clientList.sort((a, b) => {
        if (!a.mostRecentLesson) return 1;
        if (!b.mostRecentLesson) return -1;
        return b.mostRecentLesson.localeCompare(a.mostRecentLesson);
      });

      setClients(clientList);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const openNotesDialog = (client: ClientData) => {
    setSelectedClient(client);
    setEditingNotes(clientNotes[client.id]?.notes || '');
    setNotesDialogOpen(true);
  };

  const saveClientNotes = async () => {
    if (!currentUser || !selectedClient) return;

    setSavingNotes(true);
    try {
      const existingNote = clientNotes[selectedClient.id];
      
      if (existingNote?.id) {
        // Update existing note
        const { error } = await supabase
          .from('client_notes')
          .update({ notes: editingNotes, updated_at: new Date().toISOString() })
          .eq('id', existingNote.id);
        if (error) throw error;
      } else {
        // Insert new note
        const { error } = await supabase
          .from('client_notes')
          .insert({
            coach_id: currentUser.id,
            client_id: selectedClient.id,
            notes: editingNotes,
          });
        if (error) throw error;
      }

      // Update local state
      setClientNotes(prev => ({
        ...prev,
        [selectedClient.id]: {
          ...prev[selectedClient.id],
          notes: editingNotes,
          is_hidden: prev[selectedClient.id]?.is_hidden || false,
          id: prev[selectedClient.id]?.id || ''
        }
      }));

      toast.success('Notes saved successfully');
      setNotesDialogOpen(false);
      loadClients(); // Refresh to get the new note ID
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const removeClient = async (clientId: string) => {
    if (!currentUser) return;

    try {
      const existingNote = clientNotes[clientId];
      
      if (existingNote?.id) {
        // Update existing note to mark as hidden
        const { error } = await supabase
          .from('client_notes')
          .update({ is_hidden: true, updated_at: new Date().toISOString() })
          .eq('id', existingNote.id);
        if (error) throw error;
      } else {
        // Create note with hidden flag
        const { error } = await supabase
          .from('client_notes')
          .insert({
            coach_id: currentUser.id,
            client_id: clientId,
            is_hidden: true,
          });
        if (error) throw error;
      }

      // Remove from local state
      setClients(prev => prev.filter(c => c.id !== clientId));
      toast.success('Client removed from your list');
    } catch (error) {
      console.error('Error removing client:', error);
      toast.error('Failed to remove client');
    }
  };

  const startMessage = (clientId: string) => {
    navigate(`/messages?user=${clientId}`);
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(client => 
      client.full_name.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const formatRecentLesson = (date: string | null) => {
    if (!date) return 'No lessons yet';
    const lessonDate = new Date(date);
    const days = differenceInDays(new Date(), lessonDate);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return format(lessonDate, 'MMM d, yyyy');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          My Clients
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your students and track their progress
        </p>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Client List */}
      <div className="space-y-4">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Clients Yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your client list will automatically populate when you accept or complete lesson requests from players.
              </p>
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No clients match your search.</p>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Avatar & Name */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-14 w-14 flex-shrink-0">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {client.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <ProfileLink userId={client.id} className="text-lg font-semibold hover:text-primary truncate block">
                        {client.full_name}
                      </ProfileLink>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                          {client.status === 'active' ? 'Active Client' : 'Past Client'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4 md:gap-6 text-sm">
                    {/* Rankings */}
                    <div className="flex items-center gap-3">
                      {client.utr_rating && (
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          <span className="text-muted-foreground">UTR:</span>
                          <span className="font-medium">{client.utr_rating}</span>
                        </div>
                      )}
                      {client.wtn_rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">WTN:</span>
                          <span className="font-medium">{client.wtn_rating}</span>
                        </div>
                      )}
                      {client.usta_ranking && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">USTA:</span>
                          <span className="font-medium">{client.usta_ranking}</span>
                        </div>
                      )}
                      {!client.utr_rating && !client.wtn_rating && !client.usta_ranking && (
                        <span className="text-muted-foreground">No rankings</span>
                      )}
                    </div>

                    {/* Lesson Count */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Lessons:</span>
                      <span className="font-medium">{client.lessonCount}</span>
                    </div>

                    {/* Recent Lesson */}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Last:</span>
                      <span className="font-medium">{formatRecentLesson(client.mostRecentLesson)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openNotesDialog(client)}
                      className="gap-1.5"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Notes</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startMessage(client.id)}
                      className="gap-1.5"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">Message</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Client</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {client.full_name} from your client list? 
                            This will only hide them from your view. Their profile, lesson history, 
                            and account will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeClient(client.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Notes Preview */}
                {clientNotes[client.id]?.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      <span className="font-medium text-foreground">Notes: </span>
                      {clientNotes[client.id].notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Client Notes — {selectedClient?.full_name}</DialogTitle>
            <DialogDescription>
              Private notes visible only to you. Use this to track progress, goals, or reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Add notes about this client... (e.g., strengths, areas to work on, injury notes, goals)"
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveClientNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
