import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ImagePlus, X, Trophy, Settings, Users, Calendar, Shield, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';

interface CreateLadderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLadderCreated: (ladder: Ladder) => void;
  editingLadder?: Ladder | null;
}

// Required field label component
const RequiredLabel = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <Label htmlFor={htmlFor} className="flex items-center gap-1">
    {children}
    <span className="text-red-500">*</span>
  </Label>
);

const CreateLadderDialog = ({ open, onOpenChange, onLadderCreated, editingLadder }: CreateLadderDialogProps) => {
  const { currentUser } = useAuth();
  const { activeHOA } = useActiveHOA();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitialFormData = (ladder?: Ladder | null) => ({
    // Basic Info
    name: ladder?.name || '',
    description: ladder?.description || '',
    format: (ladder?.format || 'doubles') as 'singles' | 'doubles' | 'mixed_doubles',
    is_private: ladder?.is_private || false,
    
    // Dates
    start_date: ladder?.start_date || '',
    end_date: ladder?.end_date || '',
    registration_deadline: ladder?.registration_deadline || '',
    weekly_deadline_day: ladder?.weekly_deadline_day || 0,
    
    // Eligibility
    min_ntrp: ladder?.min_ntrp?.toString() || 'none',
    max_ntrp: ladder?.max_ntrp?.toString() || 'none',
    min_age: ladder?.min_age?.toString() || '',
    max_age: ladder?.max_age?.toString() || '',
    gender_restriction: (ladder?.gender_restriction || 'none') as 'none' | 'mens' | 'womens' | 'mixed',
    
    // Structure
    max_teams: ladder?.max_teams?.toString() || '20',
    auto_approve_registration: ladder?.auto_approve_registration || false,
    
    // Playoffs
    enable_playoffs: ladder?.enable_playoffs || false,
    playoff_teams_count: ladder?.playoff_teams_count?.toString() || '4',
    
    // Scoring Mode
    scoring_mode: (ladder?.scoring_mode || 'cumulative') as 'cumulative' | 'challenge',
    
    // Scoring (Cumulative mode)
    scoring_format: ladder?.scoring_format || 'best_of_3',
    third_set_format: (ladder?.third_set_format || 'super_tiebreak') as 'super_tiebreak' | 'full_set',
    points_per_win: ladder?.points_per_win?.toString() || '3',
    points_per_set: ladder?.points_per_set?.toString() || '1',
    participation_points: ladder?.participation_points?.toString() || '0',
    loss_points: ladder?.loss_points?.toString() || '0',
    tiebreaker_rule: ladder?.tiebreaker_rule || 'head_to_head',
    secondary_tiebreaker: ladder?.secondary_tiebreaker || 'games_won',
    require_score_confirmation: ladder?.require_score_confirmation ?? true,
    dispute_window_hours: ladder?.dispute_window_hours?.toString() || '48',
    
    // Challenge Rules (Challenge mode)
    challenge_range: ladder?.challenge_range?.toString() || '3',
    acceptance_window_hours: ladder?.acceptance_window_hours?.toString() || '48',
    defense_period_days: ladder?.defense_period_days?.toString() || '3',
    play_by_deadline_days: ladder?.play_by_deadline_days?.toString() || '10',
  });

  const [formData, setFormData] = useState(getInitialFormData(editingLadder));

  // Update form when editingLadder changes
  React.useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(editingLadder));
      if (editingLadder?.image_url) {
        setImagePreview(editingLadder.image_url);
      } else {
        setImagePreview(null);
      }
      setImageFile(null);
    }
  }, [open, editingLadder]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (ladderId: string): Promise<string | null> => {
    if (!imageFile) return null;
    
    const fileExt = imageFile.name.split('.').pop();
    const filePath = `ladder-images/${ladderId}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, imageFile, { upsert: true });
    
    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }
    
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const validateForm = (): string[] => {
    const missingFields: string[] = [];
    
    if (!formData.name.trim()) missingFields.push('Ladder Name');
    if (!formData.format) missingFields.push('Format');
    
    return missingFields;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) {
      toast.error('You must be logged in');
      return;
    }

    // Validate required fields
    const missingFields = validateForm();
    if (missingFields.length > 0) {
      toast.error(`Please fill out the required fields: ${missingFields.join(', ')}`);
      return;
    }

    const hoaId = activeHOA?.hoaId || editingLadder?.hoa_id || null;

    // Validate NTRP range if provided
    if (formData.min_ntrp !== 'none' && formData.max_ntrp !== 'none') {
      const minNtrp = parseFloat(formData.min_ntrp);
      const maxNtrp = parseFloat(formData.max_ntrp);
      
      if (minNtrp > maxNtrp) {
        toast.error('Minimum NTRP must be less than or equal to maximum NTRP');
        return;
      }
    }

    // Validate age range if provided
    if (formData.min_age && formData.max_age) {
      if (parseInt(formData.min_age) > parseInt(formData.max_age)) {
        toast.error('Minimum age must be less than or equal to maximum age');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const ladderData = {
        name: formData.name,
        description: formData.description || null,
        format: formData.format as any,
        is_private: formData.is_private,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        registration_deadline: formData.registration_deadline || null,
        weekly_deadline_day: formData.weekly_deadline_day,
        min_ntrp: formData.min_ntrp !== 'none' ? parseFloat(formData.min_ntrp) : null,
        max_ntrp: formData.max_ntrp !== 'none' ? parseFloat(formData.max_ntrp) : null,
        min_age: formData.min_age ? parseInt(formData.min_age) : null,
        max_age: formData.max_age ? parseInt(formData.max_age) : null,
        gender_restriction: formData.gender_restriction !== 'none' ? formData.gender_restriction : null,
        max_teams: parseInt(formData.max_teams) || 20,
        auto_approve_registration: formData.auto_approve_registration,
        enable_playoffs: formData.enable_playoffs,
        playoff_teams_count: formData.enable_playoffs ? parseInt(formData.playoff_teams_count) : null,
        scoring_mode: formData.scoring_mode,
        scoring_format: formData.scoring_format,
        third_set_format: formData.third_set_format,
        points_per_win: parseInt(formData.points_per_win),
        points_per_set: parseInt(formData.points_per_set),
        participation_points: parseInt(formData.participation_points),
        loss_points: parseInt(formData.loss_points),
        tiebreaker_rule: formData.tiebreaker_rule,
        secondary_tiebreaker: formData.secondary_tiebreaker,
        require_score_confirmation: formData.require_score_confirmation,
        dispute_window_hours: parseInt(formData.dispute_window_hours),
        challenge_range: parseInt(formData.challenge_range),
        acceptance_window_hours: parseInt(formData.acceptance_window_hours),
        defense_period_days: parseInt(formData.defense_period_days),
        play_by_deadline_days: parseInt(formData.play_by_deadline_days),
      };

      let data;
      let error;

      if (editingLadder) {
        // Update existing ladder
        const result = await supabase
          .from('ladders')
          .update(ladderData)
          .eq('id', editingLadder.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Create new ladder
        const result = await supabase
          .from('ladders')
          .insert({
            ...ladderData,
            admin_id: currentUser.id,
            hoa_id: hoaId,
            status: 'setup',
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      // Upload image if selected
      if (imageFile && data) {
        const imageUrl = await uploadImage(data.id);
        if (imageUrl) {
          await supabase
            .from('ladders')
            .update({ image_url: imageUrl })
            .eq('id', data.id);
          data.image_url = imageUrl;
        }
      }

      onLadderCreated(data);
      if (!editingLadder) {
        resetForm();
      }
      toast.success(editingLadder ? 'Ladder updated successfully!' : 'Ladder created successfully!');
    } catch (error) {
      console.error('Error saving ladder:', error);
      toast.error(editingLadder ? 'Failed to update ladder' : 'Failed to create ladder');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      format: 'doubles',
      is_private: false,
      start_date: '',
      end_date: '',
      registration_deadline: '',
      weekly_deadline_day: 0,
      min_ntrp: 'none',
      max_ntrp: 'none',
      min_age: '',
      max_age: '',
      gender_restriction: 'none',
      max_teams: '20',
      auto_approve_registration: false,
      enable_playoffs: false,
      playoff_teams_count: '4',
      scoring_mode: 'cumulative',
      scoring_format: 'best_of_3',
      third_set_format: 'super_tiebreak',
      points_per_win: '3',
      points_per_set: '1',
      participation_points: '0',
      loss_points: '0',
      tiebreaker_rule: 'head_to_head',
      secondary_tiebreaker: 'games_won',
      require_score_confirmation: true,
      dispute_window_hours: '48',
      challenge_range: '3',
      acceptance_window_hours: '48',
      defense_period_days: '3',
      play_by_deadline_days: '10',
    });
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {editingLadder ? 'Edit Ladder' : 'Create New Ladder'}
          </DialogTitle>
          <DialogDescription>
            {editingLadder ? 'Update your ladder settings and rules.' : 'Configure your competitive ladder with custom rules and settings.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic" className="text-xs">
                <Trophy className="h-3 w-3 mr-1" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="eligibility" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                Eligibility
              </TabsTrigger>
              <TabsTrigger value="structure" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Structure
              </TabsTrigger>
              <TabsTrigger value="scoring" className="text-xs">
                <Target className="h-3 w-3 mr-1" />
                Scoring
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Rules
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Ladder Image */}
              <div className="space-y-2">
                <Label>Ladder Image (Optional)</Label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <Avatar className="h-20 w-20 rounded-lg">
                        <AvatarImage src={imagePreview} className="object-cover" />
                        <AvatarFallback className="rounded-lg">🎾</AvatarFallback>
                      </Avatar>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-20 w-20 rounded-lg border-dashed flex flex-col gap-1"
                    >
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Add</span>
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <RequiredLabel htmlFor="name">Ladder Name</RequiredLabel>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Spring Doubles Championship"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the ladder..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <RequiredLabel htmlFor="format">Format</RequiredLabel>
                <Select 
                  value={formData.format} 
                  onValueChange={(value: 'singles' | 'doubles' | 'mixed_doubles') => 
                    setFormData(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Singles</SelectItem>
                    <SelectItem value="doubles">Doubles</SelectItem>
                    <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_deadline">Registration Deadline</Label>
                <Input
                  id="registration_deadline"
                  type="date"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, registration_deadline: e.target.value }))}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_private"
                  checked={formData.is_private}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_private: checked }))
                  }
                />
                <Label htmlFor="is_private">Private Ladder (invite-only)</Label>
              </div>
            </TabsContent>

            {/* Eligibility Tab */}
            <TabsContent value="eligibility" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Gender Restriction</CardTitle>
                  <CardDescription className="text-xs">Limit participation based on gender</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select 
                    value={formData.gender_restriction} 
                    onValueChange={(value: 'none' | 'mens' | 'womens' | 'mixed') => 
                      setFormData(prev => ({ ...prev, gender_restriction: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Open to All</SelectItem>
                      <SelectItem value="mens">Men's Only</SelectItem>
                      <SelectItem value="womens">Women's Only</SelectItem>
                      <SelectItem value="mixed">Mixed (requires male + female)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.gender_restriction !== 'none' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formData.gender_restriction === 'mens' && 'Only male players can register for this ladder.'}
                      {formData.gender_restriction === 'womens' && 'Only female players can register for this ladder.'}
                      {formData.gender_restriction === 'mixed' && 'Teams must consist of one male and one female player.'}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">NTRP Requirements</CardTitle>
                  <CardDescription className="text-xs">Players MUST meet these requirements to join</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_ntrp">Minimum NTRP</Label>
                      <Select 
                        value={formData.min_ntrp} 
                        onValueChange={(value) => 
                          setFormData(prev => ({ ...prev, min_ntrp: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No minimum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No minimum</SelectItem>
                          {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map(rating => (
                            <SelectItem key={rating} value={rating.toString()}>{rating}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_ntrp">Maximum NTRP</Label>
                      <Select 
                        value={formData.max_ntrp} 
                        onValueChange={(value) => 
                          setFormData(prev => ({ ...prev, max_ntrp: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No maximum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No maximum</SelectItem>
                          {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map(rating => (
                            <SelectItem key={rating} value={rating.toString()}>{rating}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(formData.min_ntrp !== 'none' || formData.max_ntrp !== 'none') && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700">
                        ⚠️ Players MUST have an NTRP rating set in their profile to join this ladder.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Age Restrictions (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_age">Minimum Age</Label>
                      <Input
                        id="min_age"
                        type="number"
                        min="1"
                        max="99"
                        value={formData.min_age}
                        onChange={(e) => setFormData(prev => ({ ...prev, min_age: e.target.value }))}
                        placeholder="No minimum"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_age">Maximum Age</Label>
                      <Input
                        id="max_age"
                        type="number"
                        min="1"
                        max="99"
                        value={formData.max_age}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_age: e.target.value }))}
                        placeholder="No maximum"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Structure Tab */}
            <TabsContent value="structure" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Team/Player Limits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_teams">
                      Maximum {formData.format === 'singles' ? 'Players' : 'Teams'}
                    </Label>
                    <Select 
                      value={formData.max_teams} 
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, max_teams: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[8, 10, 12, 16, 20, 24, 32, 48, 64].map(num => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline_day">Weekly Match Deadline</Label>
                    <Select 
                      value={formData.weekly_deadline_day.toString()} 
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, weekly_deadline_day: parseInt(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto_approve"
                      checked={formData.auto_approve_registration}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, auto_approve_registration: checked }))
                      }
                    />
                    <Label htmlFor="auto_approve">Auto-approve registrations</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Playoffs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable_playoffs"
                      checked={formData.enable_playoffs}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, enable_playoffs: checked }))
                      }
                    />
                    <Label htmlFor="enable_playoffs">Enable playoffs after round-robin</Label>
                  </div>

                  {formData.enable_playoffs && (
                    <div className="space-y-2">
                      <Label htmlFor="playoff_teams">Teams qualifying for playoffs</Label>
                      <Select 
                        value={formData.playoff_teams_count} 
                        onValueChange={(value) => 
                          setFormData(prev => ({ ...prev, playoff_teams_count: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">Top 4</SelectItem>
                          <SelectItem value="8">Top 8</SelectItem>
                          <SelectItem value="16">Top 16</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scoring Tab */}
            <TabsContent value="scoring" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Ranking Mode</CardTitle>
                  <CardDescription className="text-xs">How rankings are calculated</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select 
                    value={formData.scoring_mode} 
                    onValueChange={(value: 'cumulative' | 'challenge') => 
                      setFormData(prev => ({ ...prev, scoring_mode: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cumulative">Cumulative Points (round-robin)</SelectItem>
                      <SelectItem value="challenge">Challenge Mode (leapfrog)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.scoring_mode === 'cumulative' 
                      ? 'Players earn points for wins. Best for encouraging high volume of play.'
                      : 'Winners take the loser\'s spot. Traditional ladder format.'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Match Format</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scoring_format">Scoring Format</Label>
                    <Select 
                      value={formData.scoring_format} 
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, scoring_format: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best_of_1">Best of 1 Set</SelectItem>
                        <SelectItem value="best_of_3">Best of 3 Sets</SelectItem>
                        <SelectItem value="pro_set">Pro Set (8 Games)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.scoring_format === 'best_of_3' && (
                    <div className="space-y-2">
                      <Label htmlFor="third_set_format">3rd Set Format</Label>
                      <Select 
                        value={formData.third_set_format} 
                        onValueChange={(value: 'super_tiebreak' | 'full_set') => 
                          setFormData(prev => ({ ...prev, third_set_format: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_tiebreak">Super Tiebreak (10-point)</SelectItem>
                          <SelectItem value="full_set">Full 3rd Set</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {formData.scoring_mode === 'cumulative' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Points System</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="points_per_win">Points per Win</Label>
                        <Select 
                          value={formData.points_per_win} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, points_per_win: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="points_per_set">Bonus Points per Set</Label>
                        <Select 
                          value={formData.points_per_set} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, points_per_set: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="participation_points">Participation Points</Label>
                        <Select 
                          value={formData.participation_points} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, participation_points: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num} per match</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Points for completing a match</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loss_points">Loss Points</Label>
                        <Select 
                          value={formData.loss_points} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, loss_points: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Points for losing (prevents ranking fear)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tiebreaker">Primary Tiebreaker</Label>
                        <Select 
                          value={formData.tiebreaker_rule} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, tiebreaker_rule: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="head_to_head">Head-to-Head</SelectItem>
                            <SelectItem value="sets_won">Set Percentage</SelectItem>
                            <SelectItem value="games_won">Game Percentage</SelectItem>
                            <SelectItem value="matches_played">Most Matches Played</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary_tiebreaker">Secondary Tiebreaker</Label>
                        <Select 
                          value={formData.secondary_tiebreaker} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, secondary_tiebreaker: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="head_to_head">Head-to-Head</SelectItem>
                            <SelectItem value="sets_won">Set Percentage</SelectItem>
                            <SelectItem value="games_won">Game Percentage</SelectItem>
                            <SelectItem value="matches_played">Most Matches Played</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              {formData.scoring_mode === 'challenge' && (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Challenge Rules</CardTitle>
                      <CardDescription className="text-xs">Configure how challenges work</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="challenge_range">Challenge Range (spots)</Label>
                        <Select 
                          value={formData.challenge_range} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, challenge_range: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 3, 4, 5, 10].map(num => (
                              <SelectItem key={num} value={num.toString()}>Up to {num} spots above</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">How far up a player can challenge (prevents #50 from challenging #1)</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="defense_period_days">Defense/Cooldown Period (days)</Label>
                        <Select 
                          value={formData.defense_period_days} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, defense_period_days: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 5, 7].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num === 0 ? 'No protection' : `${num} days`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Immunity period after a match. Prevents top players from being "pelted" with challenges.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        🌴 Vacation Mode & Protection
                      </CardTitle>
                      <CardDescription className="text-xs">Rules for inactive players</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-2">
                        <p><strong>One-at-a-time Rule:</strong> Players can only be involved in one active challenge at a time.</p>
                        <p><strong>Vacation Mode:</strong> Players can toggle "inactive" to be hidden from the challenge list and freeze their rank.</p>
                        <p><strong>Auto-Forfeit:</strong> If a player doesn't respond within the acceptance window, they forfeit and the challenger takes their spot.</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 Players with vacation mode active will show a 🌴 icon and cannot be challenged.
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Match Deadlines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="acceptance_window_hours">Acceptance Window</Label>
                    <Select 
                      value={formData.acceptance_window_hours} 
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, acceptance_window_hours: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Time to respond to a challenge/match</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="play_by_deadline_days">Play-By Deadline (days)</Label>
                    <Select 
                      value={formData.play_by_deadline_days} 
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, play_by_deadline_days: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[7, 10, 14, 21].map(num => (
                          <SelectItem key={num} value={num.toString()}>{num} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Time to complete a scheduled match</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Score Submission</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="require_confirmation"
                      checked={formData.require_score_confirmation}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, require_score_confirmation: checked }))
                      }
                    />
                    <Label htmlFor="require_confirmation">Require opponent confirmation</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dispute_window">Dispute Window</Label>
                    <Select 
                      value={formData.dispute_window_hours} 
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, dispute_window_hours: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Time to dispute a submitted score</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 pt-6 border-t mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? (editingLadder ? 'Saving...' : 'Creating...') 
                : (editingLadder ? 'Save Changes' : 'Create Ladder')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLadderDialog;
