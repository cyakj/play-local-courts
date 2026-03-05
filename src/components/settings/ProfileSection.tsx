import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, MapPin, Briefcase, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProfileFormData, CoachFormData } from '@/hooks/useSettingsForm';
import { getAmenitiesByHOAId } from '@/services/supabaseService';
import { Amenity } from '@/types';

const SPORTS_OPTIONS = [
  'Tennis', 'Pickleball', 'Padel', 'Platform Tennis', 'Squash', 'Racquetball', 'Badminton'
];

const CREDENTIALS_OPTIONS = [
  { value: 'USPTA', label: 'USPTA' },
  { value: 'PTR', label: 'PTR' },
  { value: 'PPR', label: 'PPR' },
  { value: 'IPTPA', label: 'IPTPA' },
  { value: 'None', label: 'No Certification' }
];

interface ProfileSectionProps {
  profile: ProfileFormData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileFormData>>;
  coach: CoachFormData;
  setCoach: React.Dispatch<React.SetStateAction<CoachFormData>>;
  isCoach: boolean;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  profile,
  setProfile,
  coach,
  setCoach,
  isCoach
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  useEffect(() => {
    if (currentUser?.hoaId) {
      loadAmenities();
    }
  }, [currentUser?.hoaId]);

  const loadAmenities = async () => {
    if (!currentUser?.hoaId) return;
    try {
      const amenityList = await getAmenitiesByHOAId(currentUser.hoaId);
      setAmenities(amenityList.filter(a => a.amenityType === 'tennis' || a.amenityType === 'pickleball'));
    } catch (error) {
      console.error('Error loading amenities:', error);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !currentUser) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatarUrl: data.publicUrl }));
      toast({ title: "Success", description: "Avatar uploaded successfully" });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ title: "Error", description: "Failed to upload avatar", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const uploadCoachImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !currentUser) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `coach-profiles/${currentUser.id}-coach-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setCoach(prev => ({ ...prev, profileImageUrl: data.publicUrl }));
      toast({ title: "Success", description: "Coach photo uploaded successfully" });
    } catch (error) {
      console.error('Error uploading coach image:', error);
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Player Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Player Profile</CardTitle>
          <CardDescription>Your personal information visible to other players</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatarUrl} />
                <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-blue-500 text-white">
                  {profile.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-md"
              >
                <Camera className="h-4 w-4" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                className="hidden"
                disabled={uploading}
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{profile.fullName || 'Your Name'}</h3>
              {profile.zipCode && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profile.zipCode}
                </p>
              )}
            </div>
          </div>

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={profile.fullName}
                onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={profile.dateOfBirth}
                onChange={(e) => setProfile(prev => ({ ...prev, dateOfBirth: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={profile.gender} onValueChange={(value) => setProfile(prev => ({ ...prev, gender: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={profile.zipCode}
                onChange={(e) => setProfile(prev => ({ ...prev, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                placeholder="e.g. 90210"
                maxLength={5}
              />
            </div>

            {currentUser?.hoaId && amenities.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="homeCourt">Home Court</Label>
                <Select value={profile.homeCourtId} onValueChange={(value) => setProfile(prev => ({ ...prev, homeCourtId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select home court" />
                  </SelectTrigger>
                  <SelectContent>
                    {amenities.map((amenity) => (
                      <SelectItem key={amenity.id} value={amenity.id}>
                        {amenity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell us about yourself..."
              rows={3}
            />
          </div>

          {/* Tennis Ratings - hidden when tennis features disabled */}
          {TENNIS_FEATURES_ENABLED && (
          <div>
            <h4 className="font-medium mb-3">Tennis Ratings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ntrpRating">NTRP Rating</Label>
                <Select
                  value={profile.ntrpRating?.toString() || 'none'}
                  onValueChange={(value) => setProfile(prev => ({
                    ...prev,
                    ntrpRating: value === 'none' ? null : parseFloat(value)
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select NTRP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Set</SelectItem>
                    {[1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map(rating => (
                      <SelectItem key={rating} value={rating.toString()}>{rating.toFixed(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="utrRating">UTR Rating</Label>
                <Input
                  id="utrRating"
                  type="text"
                  inputMode="decimal"
                  className="[&::-webkit-inner-spin-button]:appearance-none"
                  value={profile.utrRating || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, '');
                    setProfile(prev => ({ ...prev, utrRating: value ? parseFloat(value) : null }));
                  }}
                  placeholder="e.g. 4.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wtnRating">WTN Number</Label>
                <Input
                  id="wtnRating"
                  type="text"
                  inputMode="decimal"
                  className="[&::-webkit-inner-spin-button]:appearance-none"
                  value={profile.wtnRating || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, '');
                    setProfile(prev => ({ ...prev, wtnRating: value ? parseFloat(value) : null }));
                  }}
                  placeholder="e.g. 18.5"
                />
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Coach Profile Card - Only visible for coaches */}
      {isCoach && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Coaching Profile</CardTitle>
            </div>
            <CardDescription>Your professional coaching information visible to students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Coach Image */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={coach.profileImageUrl} />
                <AvatarFallback>
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div>
                <label htmlFor="coach-image" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Photo'}
                    </span>
                  </Button>
                </label>
                <input
                  id="coach-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadCoachImage}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: Square image, at least 200x200px
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name (Optional)</Label>
                <Input
                  id="businessName"
                  placeholder="e.g., Elite Tennis Academy"
                  value={coach.businessName}
                  onChange={(e) => setCoach(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credentials">Certification</Label>
                <Select
                  value={coach.credentials}
                  onValueChange={(value) => setCoach(prev => ({ ...prev, credentials: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select certification" />
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

              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  min="0"
                  max="50"
                  value={coach.yearsExperience}
                  onChange={(e) => setCoach(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min="0"
                  step="5"
                  placeholder="e.g., 75"
                  value={coach.hourlyRate || ''}
                  onChange={(e) => setCoach(prev => ({ ...prev, hourlyRate: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="homeBase">Home Base</Label>
                <Input
                  id="homeBase"
                  placeholder="e.g., San Francisco, CA"
                  value={coach.homeBase}
                  onChange={(e) => setCoach(prev => ({ ...prev, homeBase: e.target.value }))}
                />
              </div>
            </div>

            {/* Sports Offered */}
            <div className="space-y-2">
              <Label>Sports You Coach</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SPORTS_OPTIONS.map((sport) => (
                  <div key={sport} className="flex items-center space-x-2">
                    <Checkbox
                      id={sport}
                      checked={coach.sportsOffered.includes(sport)}
                      onCheckedChange={(checked) => {
                        setCoach(prev => ({
                          ...prev,
                          sportsOffered: checked
                            ? [...prev.sportsOffered, sport]
                            : prev.sportsOffered.filter(s => s !== sport)
                        }));
                      }}
                    />
                    <label htmlFor={sport} className="text-sm cursor-pointer">
                      {sport}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Willing to Travel */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-xl">
              <div>
                <Label>Willing to Travel</Label>
                <p className="text-sm text-muted-foreground">Travel to student locations</p>
              </div>
              <Switch
                checked={coach.willingToTravel}
                onCheckedChange={(checked) => setCoach(prev => ({ ...prev, willingToTravel: checked }))}
              />
            </div>

            {/* Coach Bio */}
            <div className="space-y-2">
              <Label htmlFor="coachBio">Coaching Bio</Label>
              <Textarea
                id="coachBio"
                placeholder="Tell students about your coaching philosophy and experience..."
                value={coach.coachBio}
                onChange={(e) => setCoach(prev => ({ ...prev, coachBio: e.target.value }))}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{coach.coachBio.length}/500 characters</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfileSection;
