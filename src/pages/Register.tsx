
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
  
  const [error, setError] = useState('');
  const [hoas, setHOAs] = useState<HOA[]>([]);
  const [loadingHOAs, setLoadingHOAs] = useState(true);
  
  const { register, registerCoach } = useAuth();

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
        // Use the registerCoach method from AuthContext
        await registerCoach(fullName, email, password, {
          businessName,
          credentials,
          yearsExperience,
          sportsOffered,
          homeBase,
          willingToTravel,
          hourlyRate,
          bio
        });
      } else {
        // For players and admins
        await register(fullName, email, password, phoneNumber, dateOfBirth, selectedHOA || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
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
            <Label htmlFor="userRole">I am a <span className="text-red-500">*</span></Label>
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
              <Label htmlFor="hoa">
                Select Your Community {userRole === 'admin' ? <span className="text-red-500">*</span> : '(Optional)'}
              </Label>
              <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingHOAs ? "Loading communities..." : "Choose your HOA (or skip if not applicable)"} />
                </SelectTrigger>
                <SelectContent>
                  {hoas.map((hoa) => (
                    <SelectItem key={hoa.id} value={hoa.id}>
                      {hoa.name} {hoa.address && `- ${hoa.address}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userRole === 'player' && (
                <p className="text-sm text-gray-500">
                  You can skip this if you're not part of an HOA or prefer to join one later.
                </p>
              )}
              {userRole === 'admin' && !selectedHOA && (
                <p className="text-sm text-red-500">
                  HOA Admins must select a community to manage.
                </p>
              )}
            </div>
          )}


          {/* Basic Information */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
                  disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
                  disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credentials">Coaching Credentials <span className="text-red-500">*</span></Label>
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
                <Label htmlFor="yearsExperience">Years of Experience <span className="text-red-500">*</span></Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  min="0"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Sports Offered <span className="text-red-500">*</span></Label>
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
                <Label htmlFor="homeBase">Home Base (City or Club) <span className="text-red-500">*</span></Label>
                <Input
                  id="homeBase"
                  type="text"
                  placeholder="San Francisco, CA"
                  value={homeBase}
                  onChange={(e) => setHomeBase(e.target.value)}
                  required
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio (optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell potential students about your coaching philosophy and experience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <Button 
            type="submit" 
            className="w-full" 
              disabled={
              isLoading || 
              (userRole === 'admin' && !selectedHOA) ||
              (userRole === 'coach' && (!homeBase || sportsOffered.length === 0))
            }
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
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
