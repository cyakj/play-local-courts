import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Save, Upload, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SPORTS_OPTIONS = [
  'Tennis',
  'Pickleball', 
  'Padel',
  'Platform Tennis',
  'Squash',
  'Racquetball',
  'Badminton'
];

const CREDENTIALS_OPTIONS = [
  { value: 'USPTA', label: 'USPTA (US Professional Tennis Association)' },
  { value: 'PTR', label: 'PTR (Professional Tennis Registry)' },
  { value: 'PPR', label: 'PPR (Professional Pickleball Registry)' },
  { value: 'IPTPA', label: 'IPTPA (International Pickleball Teaching Professional Association)' },
  { value: 'None', label: 'No Certification' }
];

interface CoachProfile {
  id: string;
  user_id: string;
  business_name: string | null;
  credentials: string | null;
  years_experience: number | null;
  sports_offered: string[] | null;
  home_base: string | null;
  willing_to_travel: boolean | null;
  hourly_rate: number | null;
  bio: string | null;
  profile_image_url: string | null;
}

const CoachProfileSettings = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [formData, setFormData] = useState({
    business_name: '',
    credentials: 'None',
    years_experience: 0,
    sports_offered: [] as string[],
    home_base: '',
    willing_to_travel: false,
    hourly_rate: 0,
    bio: '',
    profile_image_url: ''
  });

  useEffect(() => {
    if (currentUser) {
      loadCoachProfile();
    }
  }, [currentUser]);

  const loadCoachProfile = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          business_name: data.business_name || '',
          credentials: data.credentials || 'None',
          years_experience: data.years_experience || 0,
          sports_offered: data.sports_offered || [],
          home_base: data.home_base || '',
          willing_to_travel: data.willing_to_travel || false,
          hourly_rate: data.hourly_rate || 0,
          bio: data.bio || '',
          profile_image_url: data.profile_image_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading coach profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser || !profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          business_name: formData.business_name || null,
          credentials: formData.credentials,
          years_experience: formData.years_experience,
          sports_offered: formData.sports_offered,
          home_base: formData.home_base || null,
          willing_to_travel: formData.willing_to_travel,
          hourly_rate: formData.hourly_rate || null,
          bio: formData.bio || null,
          profile_image_url: formData.profile_image_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-coach-${Date.now()}.${fileExt}`;
      const filePath = `coach-profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, profile_image_url: publicUrl }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSportToggle = (sport: string) => {
    setFormData(prev => ({
      ...prev,
      sports_offered: prev.sports_offered.includes(sport)
        ? prev.sports_offered.filter(s => s !== sport)
        : [...prev.sports_offered, sport]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div>Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No coach profile found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Coach Profile</CardTitle>
          <CardDescription>
            Update your coaching profile visible to students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Image */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={formData.profile_image_url} />
              <AvatarFallback>
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="profile-image" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </span>
                </Button>
              </Label>
              <input
                id="profile-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: Square image, at least 200x200px
              </p>
            </div>
          </div>

          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name (Optional)</Label>
            <Input
              id="business_name"
              placeholder="e.g., Elite Tennis Academy"
              value={formData.business_name}
              onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
            />
          </div>

          {/* Credentials */}
          <div className="space-y-2">
            <Label htmlFor="credentials">Certification/Credentials</Label>
            <Select 
              value={formData.credentials} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, credentials: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your certification" />
              </SelectTrigger>
              <SelectContent>
                {CREDENTIALS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Years of Experience */}
          <div className="space-y-2">
            <Label htmlFor="years_experience">Years of Experience</Label>
            <Input
              id="years_experience"
              type="number"
              min="0"
              max="50"
              value={formData.years_experience}
              onChange={(e) => setFormData(prev => ({ ...prev, years_experience: parseInt(e.target.value) || 0 }))}
            />
          </div>

          {/* Sports Offered */}
          <div className="space-y-2">
            <Label>Sports You Coach</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SPORTS_OPTIONS.map((sport) => (
                <div key={sport} className="flex items-center space-x-2">
                  <Checkbox
                    id={sport}
                    checked={formData.sports_offered.includes(sport)}
                    onCheckedChange={() => handleSportToggle(sport)}
                  />
                  <label
                    htmlFor={sport}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {sport}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Home Base / Location */}
          <div className="space-y-2">
            <Label htmlFor="home_base">Home Base / Location</Label>
            <Input
              id="home_base"
              placeholder="e.g., San Francisco, CA"
              value={formData.home_base}
              onChange={(e) => setFormData(prev => ({ ...prev, home_base: e.target.value }))}
            />
          </div>

          {/* Willing to Travel */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Willing to Travel</Label>
              <p className="text-sm text-muted-foreground">
                Are you willing to travel to student locations?
              </p>
            </div>
            <Switch
              checked={formData.willing_to_travel}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, willing_to_travel: checked }))}
            />
          </div>

          {/* Hourly Rate */}
          <div className="space-y-2">
            <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
            <Input
              id="hourly_rate"
              type="number"
              min="0"
              step="5"
              placeholder="e.g., 75"
              value={formData.hourly_rate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if you prefer to discuss rates directly
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell students about yourself, your coaching philosophy, and experience..."
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {formData.bio.length}/500 characters
            </p>
          </div>

          {/* Save Button */}
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachProfileSettings;
