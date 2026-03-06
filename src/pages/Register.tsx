
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';

interface HOA {
  id: string;
  name: string;
  community_type: string;
  address?: string;
}

const Register = () => {
  const [userRole, setUserRole] = useState<'player' | 'coach' | 'admin' | 'hoa_manager'>('player');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedHOA, setSelectedHOA] = useState('');
  const [livesInHOA, setLivesInHOA] = useState<boolean | null>(null);
  
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
  const navigate = useNavigate();

  useEffect(() => {
    if ((userRole === 'player' && livesInHOA) || userRole === 'admin') {
      loadHOAs();
    } else {
      setLoadingHOAs(false);
    }
  }, [userRole, livesInHOA]);

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
      if (TENNIS_FEATURES_ENABLED && userRole === 'coach') {
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
      } else if (userRole === 'hoa_manager') {
        await register(fullName, email, password, phoneNumber, dateOfBirth, '');
        toast.success('Account created! Now submit your HOA verification.');
        navigate('/hoa-application');
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

  // Worker submission confirmation screen
  if (workerSubmitted) {
    return (
      <Card className="w-full shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Application Submitted</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your application to join{' '}
            <span className="font-semibold text-foreground">
              {submittedCommunityNames.join(', ')}
            </span>{' '}
            as a maintenance worker is pending approval from the community admin.
          </p>
          <p className="text-muted-foreground text-sm">
            You will receive a notification once your application is reviewed.
            You can log in to check your status.
          </p>
          <Button asChild className="mt-4 min-h-[44px]">
            <Link to="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Join our community</CardDescription>
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
            <Select value={userRole} onValueChange={(value: typeof userRole) => setUserRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Resident</SelectItem>
                {TENNIS_FEATURES_ENABLED && (
                  <SelectItem value="coach">Coach</SelectItem>
                )}
                <SelectItem value="hoa_manager">HOA Manager (requires verification)</SelectItem>
                <SelectItem value="maintenance_worker">Maintenance Worker</SelectItem>
              </SelectContent>
            </Select>
            {userRole === 'hoa_manager' && (
              <p className="text-sm text-muted-foreground mt-2">
                After creating your account, you'll be guided to submit verification documents to prove your HOA management authority.
              </p>
            )}
            {userRole === 'maintenance_worker' && (
              <p className="text-sm text-muted-foreground mt-2">
                Join as a maintenance worker to receive and manage repair assignments from HOA communities.
              </p>
            )}
          </div>

          {/* HOA Question for Players only */}
          {userRole === 'player' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Do you live in an HOA that uses this app? <span className="text-red-500">*</span></Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="radio" 
                      id="livesInHOA-yes" 
                      name="livesInHOA" 
                      value="yes"
                      checked={livesInHOA === true}
                      onChange={() => setLivesInHOA(true)}
                      className="text-primary"
                    />
                    <Label htmlFor="livesInHOA-yes">Yes, I live in an HOA</Label>
                  </div>
                  {TENNIS_FEATURES_ENABLED && (
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="livesInHOA-no" 
                        name="livesInHOA" 
                        value="no"
                        checked={livesInHOA === false}
                        onChange={() => setLivesInHOA(false)}
                        className="text-primary"
                      />
                      <Label htmlFor="livesInHOA-no">No, I'm not part of an HOA</Label>
                    </div>
                  )}
                </div>
              </div>

              {/* HOA Selection for Players who live in HOA */}
              {livesInHOA && (
                <div className="space-y-2">
                  <Label htmlFor="hoa">Select Your Community <span className="text-red-500">*</span></Label>
                  <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading}>
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

              {TENNIS_FEATURES_ENABLED && livesInHOA === false && (
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm text-blue-800">
                    Perfect! You'll have access to tennis networking, coaching, competitive play, and public court discovery features.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* HOA Selection for Admins */}
          {userRole === 'admin' && (
            <div className="space-y-2">
              <Label htmlFor="hoa">Select Your Community <span className="text-red-500">*</span></Label>
              <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading}>
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
              {!selectedHOA && (
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

          {/* Coach-specific fields - only when tennis features enabled */}
          {TENNIS_FEATURES_ENABLED && userRole === 'coach' && (
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

          {/* Common fields for non-coach, non-worker */}
          {userRole !== 'coach' && userRole !== 'maintenance_worker' && (
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

          {/* Worker-specific fields */}
          {userRole === 'maintenance_worker' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="workerPhone">Phone Number <span className="text-red-500">*</span></Label>
                <Input
                  id="workerPhone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workerDob">Date of Birth</Label>
                <Input
                  id="workerDob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Separator />

              {/* Worker Type */}
              <div className="space-y-3">
                <Label>Worker Type <span className="text-red-500">*</span></Label>
                <div className="space-y-3">
                  <label className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${workerType === 'hoa_employee' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                    <input
                      type="radio"
                      name="workerType"
                      value="hoa_employee"
                      checked={workerType === 'hoa_employee'}
                      onChange={() => { setWorkerType('hoa_employee'); setSelectedCommunities([]); }}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">HOA Employee</div>
                      <div className="text-xs text-muted-foreground">I work exclusively for one HOA community</div>
                    </div>
                  </label>
                  <label className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${workerType === 'independent_contractor' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                    <input
                      type="radio"
                      name="workerType"
                      value="independent_contractor"
                      checked={workerType === 'independent_contractor'}
                      onChange={() => { setWorkerType('independent_contractor'); setSelectedCommunities([]); }}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">Independent Contractor</div>
                      <div className="text-xs text-muted-foreground">I work across multiple communities</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Community Selection */}
              {workerType && (
                <div className="space-y-2">
                  <Label>
                    {workerType === 'hoa_employee' ? 'Select Your Community' : 'Select Communities'}{' '}
                    <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select the community{workerType === 'independent_contractor' ? ' or communities' : ''} you provide maintenance services for.
                  </p>

                  {/* Selected tags */}
                  {selectedCommunities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedCommunities.map(id => {
                        const hoa = hoas.find(h => h.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1 pr-1">
                            {hoa?.name}
                            <button type="button" onClick={() => removeCommunity(id)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  <Input
                    placeholder="Search communities..."
                    value={communitySearch}
                    onChange={(e) => setCommunitySearch(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {loadingHOAs ? (
                      <p className="p-3 text-sm text-muted-foreground">Loading...</p>
                    ) : filteredHOAs.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No communities found</p>
                    ) : (
                      filteredHOAs.map(hoa => (
                        <button
                          key={hoa.id}
                          type="button"
                          onClick={() => handleCommunityToggle(hoa.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between min-h-[44px] ${
                            selectedCommunities.includes(hoa.id) ? 'bg-primary/10 font-medium' : ''
                          }`}
                        >
                          <span>{hoa.name}{hoa.address ? ` — ${hoa.address}` : ''}</span>
                          {selectedCommunities.includes(hoa.id) && (
                            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Specialty Categories */}
              <div className="space-y-2">
                <Label>Specialty Categories <span className="text-red-500">*</span></Label>
                <p className="text-xs text-muted-foreground">Select all categories that apply to your skills.</p>
                <div className="grid grid-cols-2 gap-2">
                  {WORKER_SPECIALTIES.map(specialty => (
                    <div key={specialty} className="flex items-center space-x-2">
                      <Checkbox
                        id={`spec-${specialty}`}
                        checked={workerSpecialties.includes(specialty)}
                        onCheckedChange={(checked) => handleSpecialtyChange(specialty, checked as boolean)}
                      />
                      <Label htmlFor={`spec-${specialty}`} className="text-sm">{specialty}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worker Bio */}
              <div className="space-y-2">
                <Label htmlFor="workerBio">Bio (optional)</Label>
                <Textarea
                  id="workerBio"
                  placeholder="Briefly describe your experience and qualifications"
                  value={workerBio}
                  onChange={(e) => setWorkerBio(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <Button 
            type="submit" 
            className="w-full min-h-[44px]" 
            disabled={
              isLoading || 
              (userRole === 'admin' && !selectedHOA) ||
              (userRole === 'player' && livesInHOA === null) ||
              (userRole === 'player' && livesInHOA === true && !selectedHOA) ||
              (TENNIS_FEATURES_ENABLED && userRole === 'coach' && (!homeBase || sportsOffered.length === 0)) ||
              (userRole === 'maintenance_worker' && (!workerType || selectedCommunities.length === 0 || workerSpecialties.length === 0 || !phoneNumber))
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
