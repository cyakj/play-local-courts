import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Trophy, Swords, Check, ImagePlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { toast } from 'sonner';
import { WizardFormData, Competition } from './types';

interface Props {
  onBack: () => void;
  onCreated: (c: Competition) => void;
  initialData?: Partial<WizardFormData>;
}

const STEPS = ['Format', 'Basic Info', 'Eligibility', 'Structure', 'Scoring', 'Rules', 'Review'];

const defaultForm: WizardFormData = {
  competitionType: '',
  name: '', description: '', imageFile: null, imagePreview: null, city: '',
  start_date: '', end_date: '', registration_deadline: '', visibility: 'public',
  format: 'doubles', gender_restriction: 'none', min_ntrp: '', max_ntrp: '',
  min_age: '', max_age: '', hoa_only: false, max_teams: '20', auto_approve_registration: false,
  weekly_deadline_day: 0, challenge_range: '3', enable_playoffs: false, playoff_teams_count: '4',
  scoring_mode: 'cumulative', scoring_format: 'best_of_3', third_set_format: 'super_tiebreak',
  points_per_win: '3', points_per_set: '1', loss_points: '0',
  tiebreaker_rule: 'head_to_head', secondary_tiebreaker: 'games_won', tertiary_tiebreaker: 'sets_percentage',
  acceptance_window_hours: '48', play_by_deadline_days: '10',
  require_score_confirmation: true, dispute_window_hours: '48',
  no_show_policy: 'forfeit', additional_rules: '',
  max_freeze_days: '30', min_players_required: '',
};

const CreateCompetitionWizard = ({ onBack, onCreated, initialData }: Props) => {
  const { currentUser, isAdmin, isCoach } = useAuth();
  const { activeHOA } = useActiveHOA();
  const [step, setStep] = useState(initialData?.competitionType ? 1 : 0);
  const [form, setForm] = useState<WizardFormData>({ ...defaultForm, ...initialData });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof WizardFormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const canAdvance = (): boolean => {
    const e: string[] = [];
    if (step === 0 && !form.competitionType) e.push('Select a format');
    if (step === 1) { if (!form.name.trim()) e.push('Name is required'); }
    setErrors(e);
    return e.length === 0;
  };

  const next = () => { if (canAdvance() && step < STEPS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      set('imageFile', file);
      const reader = new FileReader();
      reader.onload = () => set('imagePreview', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!currentUser?.id) return;
    setIsSubmitting(true);
    try {
      const hoaId = activeHOA?.hoaId || null;
      const ladderData = {
        name: form.name,
        description: form.description || null,
        format: form.format as any,
        is_private: form.visibility === 'private',
        city: form.city || null,
        hoa_only: form.visibility === 'community',
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        registration_deadline: form.registration_deadline || null,
        weekly_deadline_day: form.weekly_deadline_day,
        min_ntrp: form.min_ntrp ? parseFloat(form.min_ntrp) : null,
        max_ntrp: form.max_ntrp ? parseFloat(form.max_ntrp) : null,
        min_age: form.min_age ? parseInt(form.min_age) : null,
        max_age: form.max_age ? parseInt(form.max_age) : null,
        gender_restriction: form.gender_restriction !== 'none' ? form.gender_restriction : null,
        max_teams: parseInt(form.max_teams) || 20,
        auto_approve_registration: form.auto_approve_registration,
        enable_playoffs: form.enable_playoffs,
        playoff_teams_count: form.enable_playoffs ? parseInt(form.playoff_teams_count) : null,
        scoring_mode: form.competitionType === 'ladder' ? 'challenge' : 'cumulative',
        scoring_format: form.scoring_format,
        third_set_format: form.third_set_format,
        points_per_win: parseInt(form.points_per_win),
        points_per_set: parseInt(form.points_per_set),
        loss_points: parseInt(form.loss_points),
        tiebreaker_rule: form.tiebreaker_rule,
        secondary_tiebreaker: form.secondary_tiebreaker,
        require_score_confirmation: form.require_score_confirmation,
        dispute_window_hours: parseInt(form.dispute_window_hours),
        challenge_range: parseInt(form.challenge_range),
        acceptance_window_hours: parseInt(form.acceptance_window_hours),
        play_by_deadline_days: parseInt(form.play_by_deadline_days),
        max_freeze_days: parseInt(form.max_freeze_days) || 30,
        min_players_required: form.min_players_required ? parseInt(form.min_players_required) : null,
        admin_id: currentUser.id,
        hoa_id: hoaId,
        status: (asDraft ? 'setup' : 'active') as any,
      };

      const { data, error } = await supabase.from('ladders').insert([ladderData]).select().single();
      if (error) throw error;

      // Upload image
      if (form.imageFile && data) {
        const ext = form.imageFile.name.split('.').pop();
        const path = `ladder-images/${data.id}.${ext}`;
        await supabase.storage.from('avatars').upload(path, form.imageFile, { upsert: true });
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        await supabase.from('ladders').update({ image_url: urlData.publicUrl }).eq('id', data.id);
        data.image_url = urlData.publicUrl;
      }

      toast.success(asDraft ? 'Saved as draft!' : 'Competition published!');
      onCreated(data as Competition);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create competition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLadder = form.competitionType === 'ladder';

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="min-h-[44px]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <h1 className="text-2xl font-bold">Create Competition</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
              i < step ? 'bg-compete text-compete-foreground' :
              i === step ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
          {errors.map((e, i) => <p key={i}>• {e}</p>)}
        </div>
      )}

      {/* Step 0: Format */}
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className={`border-2 cursor-pointer transition-all ${form.competitionType === 'ladder' ? 'border-compete shadow-md' : 'border-transparent hover:border-muted'}`}
            onClick={() => setForm(prev => ({ ...prev, competitionType: 'ladder', tiebreaker_rule: 'head_to_head', secondary_tiebreaker: 'games_won', tertiary_tiebreaker: 'sets_percentage' }))}>
            <CardContent className="p-6 text-center">
              <Swords className="h-10 w-10 mx-auto mb-3 text-compete" />
              <h3 className="font-bold text-lg mb-2">Ladder</h3>
              <p className="text-sm text-muted-foreground">Players challenge opponents within ranking range. Self-organized matches with rolling standings.</p>
            </CardContent>
          </Card>
          <Card className={`border-2 cursor-pointer transition-all ${form.competitionType === 'round_robin' ? 'border-compete shadow-md' : 'border-transparent hover:border-muted'}`}
            onClick={() => setForm(prev => ({ ...prev, competitionType: 'round_robin', tiebreaker_rule: 'head_to_head', secondary_tiebreaker: 'games_won', tertiary_tiebreaker: 'sets_percentage' }))}>
            <CardContent className="p-6 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-compete" />
              <h3 className="font-bold text-lg mb-2">Round Robin</h3>
              <p className="text-sm text-muted-foreground">Scheduled matchups against all or grouped opponents. Fixed duration with final standings.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div><Label>Competition Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g., Spring Doubles Championship" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Brief description..." /></div>
          <div>
            <Label>Banner Image</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.imagePreview ? (
                <div className="relative"><img src={form.imagePreview} className="h-16 w-24 rounded-lg object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => { set('imageFile', null); set('imagePreview', null); }}><X className="h-3 w-3" /></Button></div>
              ) : (
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-16 border-dashed"><ImagePlus className="h-5 w-5 mr-2" /> Upload</Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>City / Location</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><Label>Registration Deadline</Label><Input type="date" value={form.registration_deadline} onChange={e => set('registration_deadline', e.target.value)} /></div>
            <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
            <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={form.visibility} onValueChange={v => set('visibility', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="community">Community Only</SelectItem>}
                <SelectItem value="public">Public</SelectItem>
                {isCoach && <SelectItem value="private">Private (Invite Only)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Step 2: Eligibility */}
      {step === 2 && (
        <div className="space-y-4">
          <div><Label>Format</Label>
            <Select value={form.format} onValueChange={v => set('format', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="singles">Singles</SelectItem><SelectItem value="doubles">Doubles</SelectItem><SelectItem value="mixed_doubles">Mixed Doubles</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Gender Restriction</Label>
            <Select value={form.gender_restriction} onValueChange={v => set('gender_restriction', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No Restriction</SelectItem><SelectItem value="mens">Men's Only</SelectItem><SelectItem value="womens">Women's Only</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Min NTRP</Label><Input type="number" step="0.5" min="1.5" max="7" value={form.min_ntrp} onChange={e => set('min_ntrp', e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set('min_ntrp', String(Math.round(v * 2) / 2)); }} placeholder="e.g., 3.0" /></div>
            <div><Label>Max NTRP</Label><Input type="number" step="0.5" min="1.5" max="7" value={form.max_ntrp} onChange={e => set('max_ntrp', e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set('max_ntrp', String(Math.round(v * 2) / 2)); }} placeholder="e.g., 4.5" /></div>
            <div><Label>Min Age</Label><Input type="number" value={form.min_age} onChange={e => set('min_age', e.target.value)} placeholder="Optional" /></div>
            <div><Label>Max Age</Label><Input type="number" value={form.max_age} onChange={e => set('max_age', e.target.value)} placeholder="Optional" /></div>
          </div>
          <div><Label>{form.format === 'singles' ? 'Max Players' : 'Max Teams'}</Label><Input type="number" value={form.max_teams} onChange={e => set('max_teams', e.target.value)} /></div>
          <div className="flex items-center justify-between py-2">
            <Label>Auto-approve registrations</Label>
            <Switch checked={form.auto_approve_registration} onCheckedChange={v => set('auto_approve_registration', v)} />
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            Player ratings are verified at the time of registration only. Players who are already registered will not be affected by rating changes during the competition.
          </p>
        </div>
      )}

      {/* Step 3: Structure */}
      {step === 3 && (
        <div className="space-y-4">
          <div><Label>Weekly Match Deadline Day</Label>
            <Select value={String(form.weekly_deadline_day)} onValueChange={v => set('weekly_deadline_day', parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isLadder && (
            <div><Label>Challenge Range (rungs above)</Label><Input type="number" min="1" max="10" value={form.challenge_range} onChange={e => set('challenge_range', e.target.value)} /></div>
          )}
          <div className="flex items-center justify-between py-2">
            <Label>Enable Playoffs</Label>
            <Switch checked={form.enable_playoffs} onCheckedChange={v => set('enable_playoffs', v)} />
          </div>
          {form.enable_playoffs && (
            <div><Label>Playoff Teams Count</Label><Input type="number" min="2" max="16" value={form.playoff_teams_count} onChange={e => set('playoff_teams_count', e.target.value)} /></div>
          )}
          <div><Label>{form.format === 'singles' ? 'Minimum Players Required' : 'Minimum Teams Required'}</Label>
            <Input type="number" min="2" value={form.min_players_required} onChange={e => set('min_players_required', e.target.value)} placeholder="Optional — admin notified if not met" />
            <p className="text-xs text-muted-foreground mt-1">If set, the admin will be notified 48 hours before the registration deadline if the minimum is not reached.</p>
          </div>
        </div>
      )}

      {/* Step 4: Scoring */}
      {step === 4 && (
        <div className="space-y-4">
          <div><Label>Scoring Format</Label>
            <Select value={form.scoring_format} onValueChange={v => set('scoring_format', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="best_of_3">Best of 3 Sets</SelectItem>
                <SelectItem value="best_of_1">Best of 1 Set</SelectItem>
                <SelectItem value="pro_set">8-Game Pro Set</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Third Set Format</Label>
            <Select value={form.third_set_format} onValueChange={v => set('third_set_format', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_set">Full Third Set</SelectItem>
                <SelectItem value="super_tiebreak">Super Tiebreak (10-point)</SelectItem>
                <SelectItem value="match_tiebreak">Match Tiebreak</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ladder-only: points fields */}
          {isLadder && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Points per Win</Label><Input type="number" value={form.points_per_win} onChange={e => set('points_per_win', e.target.value)} /></div>
              <div><Label>Bonus Points per Set Won</Label><Input type="number" value={form.points_per_set} onChange={e => set('points_per_set', e.target.value)} /></div>
              <div>
                <Label>Loss Points</Label>
                <Input type="number" value={form.loss_points} onChange={e => set('loss_points', e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Optional — award points for losses to encourage participation.</p>
              </div>
            </div>
          )}

          <div><Label>Primary Tiebreaker</Label>
            <Select value={form.tiebreaker_rule} onValueChange={v => set('tiebreaker_rule', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="head_to_head">{isLadder ? 'Head-to-Head' : 'Head-to-Head Record'}</SelectItem>
                <SelectItem value="game_percentage">Game{isLadder ? '' : 's Won'} Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Secondary Tiebreaker</Label>
            <Select value={form.secondary_tiebreaker} onValueChange={v => set('secondary_tiebreaker', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="games_won">{isLadder ? 'Games Won' : 'Games Won Percentage'}</SelectItem>
                <SelectItem value="sets_won">{isLadder ? 'Sets Won' : 'Sets Won Percentage'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Round Robin-only: tertiary tiebreaker */}
          {!isLadder && (
            <>
              <div><Label>Tertiary Tiebreaker</Label>
                <Select value={form.tertiary_tiebreaker || 'sets_percentage'} onValueChange={v => set('tertiary_tiebreaker', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sets_percentage">Sets Won Percentage</SelectItem>
                    <SelectItem value="games_percentage">Games Won Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                Round robin standings are determined by win/loss record. Tiebreakers are applied in order when two or more players have identical records.
              </p>
            </>
          )}
        </div>
      )}

      {/* Step 5: Rules */}
      {step === 5 && (
        <div className="space-y-4">
          {isLadder && (
            <div><Label>Challenge Acceptance Window (hours)</Label><Input type="number" value={form.acceptance_window_hours} onChange={e => set('acceptance_window_hours', e.target.value)} /></div>
          )}
          <div><Label>Play-by Deadline (days)</Label><Input type="number" value={form.play_by_deadline_days} onChange={e => set('play_by_deadline_days', e.target.value)} /></div>
          <div className="flex items-center justify-between py-2">
            <Label>Require Score Confirmation</Label>
            <Switch checked={form.require_score_confirmation} onCheckedChange={v => set('require_score_confirmation', v)} />
          </div>
          <div><Label>Dispute Window (hours)</Label><Input type="number" value={form.dispute_window_hours} onChange={e => set('dispute_window_hours', e.target.value)} /></div>
          <div><Label>No-Show Policy</Label>
            <Select value={form.no_show_policy} onValueChange={v => set('no_show_policy', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="warning">Warning</SelectItem><SelectItem value="forfeit">Forfeit</SelectItem><SelectItem value="disqualification">Disqualification</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Maximum Freeze Days</Label>
            <Input type="number" min="0" max="90" value={form.max_freeze_days} onChange={e => set('max_freeze_days', e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Maximum number of days a player can freeze their participation per season.</p>
          </div>
          <div><Label>Additional Rules</Label><Textarea value={form.additional_rules} onChange={e => set('additional_rules', e.target.value)} rows={3} placeholder="Any extra rules..." /></div>
        </div>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Review Your Competition</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{form.competitionType === 'ladder' ? 'Ladder' : 'Round Robin'}</span></div>
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{form.name}</span></div>
                <div><span className="text-muted-foreground">Format:</span> <span className="font-medium capitalize">{form.format.replace('_', ' ')}</span></div>
                <div><span className="text-muted-foreground">Visibility:</span> <span className="font-medium capitalize">{form.visibility}</span></div>
                {form.city && <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{form.city}</span></div>}
                {form.start_date && <div><span className="text-muted-foreground">Start:</span> <span className="font-medium">{form.start_date}</span></div>}
                {form.end_date && <div><span className="text-muted-foreground">End:</span> <span className="font-medium">{form.end_date}</span></div>}
                <div><span className="text-muted-foreground">{form.format === 'singles' ? 'Max Players' : 'Max Teams'}:</span> <span className="font-medium">{form.max_teams}</span></div>
                <div><span className="text-muted-foreground">Scoring:</span> <span className="font-medium capitalize">{form.scoring_format.replace('_', ' ')}</span></div>
                <div><span className="text-muted-foreground">Points/Win:</span> <span className="font-medium">{form.points_per_win}</span></div>
                {form.min_ntrp && <div><span className="text-muted-foreground">NTRP:</span> <span className="font-medium">{form.min_ntrp}-{form.max_ntrp}</span></div>}
                <div><span className="text-muted-foreground">Auto-approve:</span> <span className="font-medium">{form.auto_approve_registration ? 'Yes' : 'No'}</span></div>
                <div><span className="text-muted-foreground">No-Show Policy:</span> <span className="font-medium capitalize">{form.no_show_policy}</span></div>
                <div><span className="text-muted-foreground">Max Freeze Days:</span> <span className="font-medium">{form.max_freeze_days}</span></div>
                {form.min_players_required && <div><span className="text-muted-foreground">{form.format === 'singles' ? 'Min Players' : 'Min Teams'}:</span> <span className="font-medium">{form.min_players_required}</span></div>}
              </div>
              {form.description && <div><span className="text-muted-foreground">Description:</span> <p className="mt-1">{form.description}</p></div>}
              {form.additional_rules && <div><span className="text-muted-foreground">Additional Rules:</span> <p className="mt-1">{form.additional_rules}</p></div>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={step === 0 ? onBack : prev} className="min-h-[44px]">
          <ArrowLeft className="mr-2 h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={isSubmitting} className="min-h-[44px]">
              Save as Draft
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
              {isSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCompetitionWizard;
