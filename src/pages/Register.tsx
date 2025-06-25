
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface HOA {
  id: string;
  name: string;
  community_type: string;
  address?: string;
}

const Register = () => {
  const [userRole, setUserRole] = useState<'player' | 'coach' | 'admin'>('player');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedHOA, setSelectedHOA] = useState('');
  
  // Coach-specific fields
  const [businessName, setBusinessName] = useState('');
  const [credentials, setCredentials] = useState<'USPTA' | 'PTR' | 'None'>('None');
  const [yearsExperience, setYearsExperience] = useState<number>(0);
  const [sportsOffered, setSportsOffered] = useState<string[]>([]);
  const [homeBase, setHomeBase] = useState('');
  const [willingToTravel, setWillingToTravel] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [bio, setBio] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoas, setHOAs] = useState<HOA[]>([]);
  const [loadingHOAs, setLoadingHOAs] = useState(true);
  
  const { register } = useAuth();

  useEffect(() => {
    if (userRole === 'player' || userRole === 'admin') {
      loadHOAs();
    } else {
      setLoadingHOAs(false);
    }
  }, [userRole]);

  const loadHOAs = async () => {
    try {
      const { data, error } = await supabase
        .from('hoas')
        .select('id, name, community_type, address')
        .order('name');

      if (error) throw error;
      setHOAs(data || []);
    } catch (error) {
      console.error('Error loading HOAs:', error);
      toast.error('Failed to load communities');
    } finally {
      setLoadingHOAs(false);
    }
  };

  const handleSportChange = (sport: string, checked: boolean) => {
    if (checked) {
      setSportsOffered([...sportsOffered, sport]);
    } else {
      setSportsOffered(sportsOffered.filter(s => s !== sport));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (userRole === 'coach') {
        await registerCoach();
      } else {
        await register(fullName, email, password, phoneNumber, dateOfBirth, selectedHOA);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  const registerCoach = async () => {
    if (sportsOffered.length === 0) {
      throw new Error('Please select at least one sport you offer coaching for');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
          phone_number: phoneNumber,
          date_of_birth: dateOfBirth,
          hoa_role: 'coach',
          hoa_status: 'approved', // Coaches don't need HOA approval
        }
      }
    });

    if (error) {
      console.error('Coach registration error:', error);
      throw error;
    }

    if (data.user) {
      // Create coach profile
      const { error: coachError } = await supabase
        .from('coaches')
        .insert({
          user_id: data.user.id,
          business_name: businessName || null,
          credentials,
          years_experience: yearsExperience,
          sports_offered: sportsOffered,
          home_base: homeBase,
          willing_to_travel: willingToTravel,
          hourly_rate: hourlyRate || null,
          bio: bio || null
        });

      if (coachError) {
        console.error('Error creating coach profile:', coachError);
        throw new Error('Failed to create coach profile');
      }

      toast.success("Coach registration successful! Please check your email to confirm your account.");
    }
  };

  const handleGoogleSignUp = async () => {
    if (userRole !== 'coach' && !selectedHOA) {
      setError('Please select an HOA before signing up with Google');
      return;
    }

    setError('');
    setIsGoogleLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/complete-profile`,
          queryParams: userRole === 'coach' ? { user_role: 'coach' } : { hoa_id: selectedHOA }
        }
      });
      
      if (error) {
        console.error('Google signup error:', error);
        toast.error(error.message || 'Failed to sign up with Google');
        setError(error.message || 'Failed to sign up with Google');
      }
    } catch (err: any) {
      console.error('Google signup error:', err);
      toast.error('Failed to sign up with Google');
      setError('Failed to sign up with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Join our tennis and amenity community</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="userRole">I am a *</Label>
            <Select value={userRole} onValueChange={(value: 'player' | 'coach' | 'admin') => setUserRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Player (HOA resident or non-resident)</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="admin">HOA Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* HOA Selection for Players and Admins */}
          {(userRole === 'player' || userRole === 'admin') && (
            <div className="space-y-2">
              <Label htmlFor="hoa">Select Your Community *</Label>
              <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading || isGoogleLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingHOAs ? "Loading communities..." : "Choose your HOA"} />
                </SelectTrigger>
                <SelectContent>
                  {hoas.map((hoa) => (
                    <SelectItem key={hoa.id} value={hoa.id}>
                      {hoa.name} {hoa.address && `- ${hoa.address}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Google Sign Up Button */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-3 hover:bg-gray-50"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading || isLoading || (userRole !== 'coach' && !selectedHOA)}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isGoogleLoading ? 'Signing up with Google...' : 'Continue with Google'}
            </Button>
          </div>

          <div className="relative">
            <Separator />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-muted-foreground">
              or
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading || isGoogleLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || isGoogleLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading || isGoogleLoading}
            />
          </div>

          {/* Coach-specific fields */}
          {userRole === 'coach' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="businessName">Coaching Business Name (optional)</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Elite Tennis Coaching"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credentials">Coaching Credentials *</Label>
                <Select value={credentials} onValueChange={(value: 'USPTA' | 'PTR' | 'None') => setCredentials(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USPTA">USPTA Certified</SelectItem>
                    <SelectItem value="PTR">PTR Certified</SelectItem>
                    <SelectItem value="None">No Formal Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience *</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  min="0"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)}
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Sports Offered *</Label>
                <div className="flex flex-wrap gap-4">
                  {['Tennis', 'Pickleball', 'Padel'].map((sport) => (
                    <div key={sport} className="flex items-center space-x-2">
                      <Checkbox
                        id={sport}
                        checked={sportsOffered.includes(sport)}
                        onCheckedChange={(checked) => handleSportChange(sport, checked as boolean)}
                      />
                      <Label htmlFor={sport}>{sport}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="homeBase">Home Base (City or Club) *</Label>
                <Input
                  id="homeBase"
                  type="text"
                  placeholder="San Francisco, CA"
                  value={homeBase}
                  onChange={(e) => setHomeBase(e.target.value)}
                  required
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="willingToTravel"
                  checked={willingToTravel}
                  onCheckedChange={(checked) => setWillingToTravel(checked as boolean)}
                />
                <Label htmlFor="willingToTravel">Willing to travel to HOAs</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Preferred Hourly Rate (USD, optional)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="75.00"
                  value={hourlyRate || ''}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || undefined)}
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio (optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell potential students about your coaching philosophy and experience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                />
              </div>
            </>
          )}

          {/* Common fields for players */}
          {userRole !== 'coach' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                />
              </div>
            </>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={
              isLoading || 
              isGoogleLoading || 
              (userRole !== 'coach' && !selectedHOA) ||
              (userRole === 'coach' && (!homeBase || sportsOffered.length === 0))
            }
          >
            {isLoading ? 'Creating Account...' : 'Create Account with Email'}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center w-full">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default Register;
