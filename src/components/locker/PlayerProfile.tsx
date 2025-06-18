
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, Upload, Calendar, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAmenitiesByHOAId } from '../../services/supabaseService';
import { Amenity } from '../../types';

interface ProfileData {
  fullName: string;
  avatarUrl: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  homeCourtId: string;
  utrRating: number | null;
  ntrpRating: number | null;
  wtnRating: number | null;
}

const PlayerProfile = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [profile, setProfile] = useState<ProfileData>({
    fullName: '',
    avatarUrl: '',
    dateOfBirth: '',
    gender: '',
    bio: '',
    homeCourtId: '',
    utrRating: null,
    ntrpRating: null,
    wtnRating: null
  });

  useEffect(() => {
    if (currentUser) {
      loadProfile();
      loadAmenities();
    }
  }, [currentUser]);

  const loadProfile = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          fullName: data.full_name || '',
          avatarUrl: data.avatar_url || '',
          dateOfBirth: data.date_of_birth || '',
          gender: data.gender || '',
          bio: data.bio || '',
          homeCourtId: data.home_court_id || '',
          utrRating: data.utr_rating,
          ntrpRating: (data as any).ntrp_rating,
          wtnRating: data.wtn_rating
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive"
      });
    }
  };

  const loadAmenities = async () => {
    if (!currentUser?.hoaId) return;

    try {
      const amenityList = await getAmenitiesByHOAId(currentUser.hoaId);
      const tennisAmenities = amenityList.filter(amenity => 
        amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball'
      );
      setAmenities(tennisAmenities);
    } catch (error) {
      console.error('Error loading amenities:', error);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          avatar_url: profile.avatarUrl,
          date_of_birth: profile.dateOfBirth || null,
          gender: profile.gender || null,
          bio: profile.bio || null,
          home_court_id: profile.homeCourtId || null,
          utr_rating: profile.utrRating,
          ntrp_rating: profile.ntrpRating,
          wtn_rating: profile.wtnRating
        })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Save error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setProfile(prev => ({ ...prev, avatarUrl: data.publicUrl }));

      toast({
        title: "Success",
        description: "Avatar uploaded successfully"
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const getAge = () => {
    if (!profile.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(profile.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const generateSearchUrl = (platform: string, name: string) => {
    const encodedName = encodeURIComponent(name);
    switch (platform) {
      case 'utr':
        return `https://app.universaltennis.com/search?q=${encodedName}`;
      case 'wtn':
        return `https://worldtennisnumber.com/eng/player-search/?search=${encodedName}`;
      case 'ntrp':
        return `https://www.usta.com/en/home/play/player-search.html#page=1&search=${encodedName}`;
      default:
        return '#';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Profile Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Player Profile Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatarUrl} alt={profile.fullName} />
                <AvatarFallback>
                  {profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" disabled={uploading} asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Photo'}
                    </span>
                  </Button>
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={uploadAvatar}
                  className="hidden"
                />
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={profile.fullName}
                  onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) => setProfile(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  />
                  {getAge() && (
                    <span className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      Age {getAge()}
                    </span>
                  )}
                </div>
              </div>

              <div>
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

              <div>
                <Label htmlFor="homeCourt">Home Court Preference</Label>
                <Select value={profile.homeCourtId} onValueChange={(value) => setProfile(prev => ({ ...prev, homeCourtId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select home court" />
                  </SelectTrigger>
                  <SelectContent>
                    {amenities.map((amenity) => (
                      <SelectItem key={amenity.id} value={amenity.id}>
                        {amenity.name} ({amenity.amenityType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rankings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Tennis Rankings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="utrRating">UTR Rating</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Used in high school, college, and global junior competition</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {profile.fullName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(generateSearchUrl('utr', profile.fullName), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  id="utrRating"
                  type="number"
                  step="0.1"
                  min="1"
                  max="16"
                  value={profile.utrRating || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, utrRating: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="e.g. 4.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="ntrpRating">NTRP Rating</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Used in USTA leagues and adult tournaments</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {profile.fullName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(generateSearchUrl('ntrp', profile.fullName), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  id="ntrpRating"
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="7.0"
                  value={profile.ntrpRating || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, ntrpRating: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="e.g. 4.0"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="wtnRating">WTN Number</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>World Tennis Number - global rating system</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {profile.fullName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(generateSearchUrl('wtn', profile.fullName), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  id="wtnRating"
                  type="number"
                  step="0.1"
                  min="1"
                  max="40"
                  value={profile.wtnRating || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, wtnRating: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="e.g. 18.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PlayerProfile;
