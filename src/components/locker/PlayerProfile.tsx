
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Upload, 
  Calendar, 
  HelpCircle, 
  LogOut, 
  MapPin, 
  User,
  Shield,
  Bell,
  Mail,
  Phone,
  Lock,
  Pencil,
  Eye,
  Camera,
  Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveHOA } from '../../contexts/ActiveHOAContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAmenitiesByHOAId } from '../../services/supabaseService';
import { Amenity } from '../../types';
import { capitalizeWords } from '@/lib/textUtils';
import { isValidZipCode } from '@/lib/zipCodeUtils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

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
  zipCode: string;
  locationVisible: boolean;
  showExactDistance: boolean;
}

type ActiveSection = 'details' | 'privacy' | 'notifications';

const PlayerProfile = () => {
  const { currentUser, logout } = useAuth();
  const { memberships, activeHOA } = useActiveHOA();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('details');
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    fullName: '',
    avatarUrl: '',
    dateOfBirth: '',
    gender: '',
    bio: '',
    homeCourtId: '',
    utrRating: null,
    ntrpRating: null,
    wtnRating: null,
    zipCode: '',
    locationVisible: true,
    showExactDistance: true
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
          ntrpRating: data.ntrp_rating,
          wtnRating: data.wtn_rating,
          zipCode: data.zip_code || '',
          locationVisible: data.location_visible !== false,
          showExactDistance: data.show_exact_distance !== false
        });
        if (data.created_at) {
          setMemberSince(format(new Date(data.created_at), 'MMM yyyy'));
        }
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

    if (profile.zipCode && !isValidZipCode(profile.zipCode)) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit US ZIP code",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const capitalizedName = capitalizeWords(profile.fullName);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: capitalizedName,
          avatar_url: profile.avatarUrl,
          date_of_birth: profile.dateOfBirth || null,
          gender: profile.gender || null,
          bio: profile.bio || null,
          home_court_id: profile.homeCourtId || null,
          utr_rating: profile.utrRating,
          ntrp_rating: profile.ntrpRating,
          wtn_rating: profile.wtnRating,
          zip_code: profile.zipCode || null,
          location_visible: profile.locationVisible,
          show_exact_distance: profile.showExactDistance
        })
        .eq('id', currentUser.id);
      
      setProfile(prev => ({ ...prev, fullName: capitalizedName }));

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
      setIsEditing(false);
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

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

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
    return age > 0 ? age : null;
  };

  const getNtrpTier = (rating: number | null) => {
    if (!rating) return null;
    if (rating >= 5.0) return { label: 'Advanced', color: 'bg-purple-100 text-purple-700' };
    if (rating >= 4.0) return { label: 'Intermediate+', color: 'bg-blue-100 text-blue-700' };
    if (rating >= 3.0) return { label: 'Intermediate', color: 'bg-green-100 text-green-700' };
    return { label: 'Beginner', color: 'bg-gray-100 text-gray-700' };
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive"
      });
    }
  };

  const tier = getNtrpTier(profile.ntrpRating);

  return (
    <TooltipProvider>
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* Left Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <Card className="sticky top-4">
            <CardContent className="pt-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative mb-4">
                  <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                    <AvatarImage src={profile.avatarUrl} alt={profile.fullName} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-blue-500 text-white">
                      {profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <Label 
                    htmlFor="avatar-upload" 
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-md"
                  >
                    <Camera className="h-4 w-4" />
                  </Label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>
                
                <h2 className="text-xl font-bold">{profile.fullName || 'Your Name'}</h2>
                {profile.zipCode && (
                  <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>{profile.zipCode}</span>
                  </div>
                )}
                {memberSince && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Member since {memberSince}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 mb-6">
                <Button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className="w-full"
                  variant={isEditing ? "default" : "default"}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  asChild
                >
                  <Link to={`/profile/${currentUser?.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Public View
                  </Link>
                </Button>
              </div>

              {/* Navigation Menu */}
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveSection('details')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === 'details' 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <User className="h-4 w-4" />
                  Profile Details
                </button>
                <button
                  onClick={() => setActiveSection('privacy')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === 'privacy' 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Privacy & Security
                </button>
                <button
                  onClick={() => setActiveSection('notifications')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === 'notifications' 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeSection === 'details' && (
            <>
              {/* Account Details Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 py-3 border-b">
                    <div className="p-2 bg-muted rounded-lg">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email Address</p>
                      <p className="font-medium">{currentUser?.email || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-3 border-b">
                    <div className="p-2 bg-muted rounded-lg">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone Number</p>
                      <p className="font-medium">Not set</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Password</p>
                      <p className="font-medium">••••••••••••</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Player Profile Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Player Profile</CardTitle>
                    {isEditing && (
                      <Button size="sm" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-6">
                      {/* Editable Fields */}
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
                          <Input
                            id="dateOfBirth"
                            type="date"
                            value={profile.dateOfBirth}
                            onChange={(e) => setProfile(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                          />
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
                          <Label htmlFor="zipCode">ZIP Code</Label>
                          <Input
                            id="zipCode"
                            value={profile.zipCode}
                            onChange={(e) => setProfile(prev => ({ ...prev, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                            placeholder="e.g. 90210"
                            maxLength={5}
                          />
                        </div>

                        {currentUser?.hoaId && (
                          <div>
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

                      {/* Ratings */}
                      <div>
                        <h4 className="font-medium mb-3">Tennis Ratings</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="ntrpRating">NTRP Rating</Label>
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
                            <Label htmlFor="utrRating">UTR Rating</Label>
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
                            <Label htmlFor="wtnRating">WTN Number</Label>
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
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">NTRP Rating</p>
                        <p className="text-2xl font-bold">{profile.ntrpRating || '—'}</p>
                        {tier && (
                          <Badge variant="secondary" className={`mt-1 text-xs ${tier.color}`}>
                            {tier.label}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">UTR Rating</p>
                        <p className="text-2xl font-bold">{profile.utrRating || '—'}</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-xl text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gender</p>
                        <p className="text-lg font-semibold capitalize">{profile.gender || '—'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Memberships Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Memberships & Associations</CardTitle>
                    <Button variant="link" size="sm" className="text-primary" asChild>
                      <Link to="/my-locker?tab=community">View All</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {memberships.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {memberships.slice(0, 4).map((membership) => (
                        <div 
                          key={membership.id} 
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                        >
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{membership.hoaName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{membership.role}</p>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className="bg-green-100 text-green-700 text-xs"
                          >
                            Active
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No community memberships yet</p>
                      <Button variant="link" asChild className="mt-2">
                        <Link to="/my-locker?tab=community">Join a Community</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'privacy' && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Privacy & Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Location-Based Searches</p>
                    <p className="text-sm text-muted-foreground">Allow others to find you based on distance</p>
                  </div>
                  <Switch
                    checked={profile.locationVisible}
                    onCheckedChange={(checked) => {
                      setProfile(prev => ({ ...prev, locationVisible: checked }));
                      supabase
                        .from('profiles')
                        .update({ location_visible: checked })
                        .eq('id', currentUser?.id)
                        .then(() => {
                          toast({ title: "Preference saved" });
                        });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Show Exact Distance</p>
                    <p className="text-sm text-muted-foreground">When disabled, others see "Nearby" instead of miles</p>
                  </div>
                  <Switch
                    checked={profile.showExactDistance}
                    onCheckedChange={(checked) => {
                      setProfile(prev => ({ ...prev, showExactDistance: checked }));
                      supabase
                        .from('profiles')
                        .update({ show_exact_distance: checked })
                        .eq('id', currentUser?.id)
                        .then(() => {
                          toast({ title: "Preference saved" });
                        });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Public Profile</p>
                    <p className="text-sm text-muted-foreground">Allow others to see your stats and skill level</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Match Requests</p>
                    <p className="text-sm text-muted-foreground">Get notified when someone wants to play</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Lesson Updates</p>
                    <p className="text-sm text-muted-foreground">Notifications about lesson bookings and changes</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Community Announcements</p>
                    <p className="text-sm text-muted-foreground">Updates from your HOA communities</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">New Messages</p>
                    <p className="text-sm text-muted-foreground">Get notified when you receive new messages</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PlayerProfile;
