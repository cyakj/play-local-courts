
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MatchRequestDialogProps {
  targetPlayer: {
    id: string;
    full_name: string;
    match_types: string[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MatchRequestDialog: React.FC<MatchRequestDialogProps> = ({ 
  targetPlayer, 
  open, 
  onOpenChange 
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState({
    matchType: '',
    date: '',
    timeStart: '',
    timeEnd: '',
    location: '',
    message: ''
  });

  const handleSubmit = async () => {
    const missingFields: string[] = [];
    
    if (!request.matchType) missingFields.push('Match Type');
    if (!request.date) missingFields.push('Preferred Date');
    if (!request.timeStart) missingFields.push('Start Time');
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }
    
    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to send a match request",
        variant: "destructive"
      });
      return;
    }

    // Map match types to database enum values
    const mapMatchType = (type: string): "singles" | "doubles" => {
      if (type === 'doubles' || type === 'mixed_doubles') return 'doubles';
      return 'singles'; // Default to singles for hitting_session and singles
    };

    setLoading(true);
    try {
      const { error } = await supabase
        .from('match_requests')
        .insert({
          challenger_id: currentUser.id,
          opponent_id: targetPlayer.id,
          match_type: mapMatchType(request.matchType),
          date: request.date,
          time_start: request.timeStart,
          time_end: request.timeEnd || null,
          location: request.location || null,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Match request sent to ${targetPlayer.full_name}!`
      });

      onOpenChange(false);
      setRequest({
        matchType: '',
        date: '',
        timeStart: '',
        timeEnd: '',
        location: '',
        message: ''
      });
    } catch (error: any) {
      console.error('Error sending match request:', error);
      toast({
        title: "Error",
        description: "Failed to send match request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatMatchType = (type: string) => {
    switch (type) {
      case 'singles': return 'Singles';
      case 'doubles': return 'Doubles';
      case 'mixed_doubles': return 'Mixed Doubles';
      case 'hitting_session': return 'Hitting Session';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Match with {targetPlayer.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="matchType">Match Type *</Label>
            <Select value={request.matchType} onValueChange={(value) => setRequest(prev => ({ ...prev, matchType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select match type" />
              </SelectTrigger>
              <SelectContent>
                {targetPlayer.match_types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatMatchType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="date">Preferred Date *</Label>
            <Input
              id="date"
              type="date"
              value={request.date}
              onChange={(e) => setRequest(prev => ({ ...prev, date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="timeStart">Start Time *</Label>
              <Input
                id="timeStart"
                type="time"
                value={request.timeStart}
                onChange={(e) => setRequest(prev => ({ ...prev, timeStart: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="timeEnd">End Time</Label>
              <Input
                id="timeEnd"
                type="time"
                value={request.timeEnd}
                onChange={(e) => setRequest(prev => ({ ...prev, timeEnd: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location/Court</Label>
            <Input
              id="location"
              value={request.location}
              onChange={(e) => setRequest(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g. Community Tennis Court #1"
            />
          </div>

          <div>
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={request.message}
              onChange={(e) => setRequest(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Add a personal message..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchRequestDialog;
