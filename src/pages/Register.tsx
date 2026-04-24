
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#0F1F3D',
  marginBottom: 6,
  fontFamily: 'Inter, sans-serif',
};

const inputBase: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  padding: '14px 16px',
  fontSize: 15,
  color: '#0F1F3D',
  fontFamily: 'Inter, sans-serif',
  background: 'white',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

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
  const [focused, setFocused] = useState<string | null>(null);

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
        await register(fullName, email, password, phoneNumber, dateOfBirth, selectedHOA || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = (field: string): React.CSSProperties => ({
    ...inputBase,
    border: `1px solid ${focused === field ? '#00D4FF' : 'rgba(15,31,61,0.15)'}`,
    outline: focused === field ? '2px solid rgba(0,212,255,0.2)' : 'none',
    outlineOffset: 0,
  });

  const isSubmitDisabled =
    isLoading ||
    (userRole === 'admin' && !selectedHOA) ||
    (userRole === 'player' && livesInHOA === null) ||
    (userRole === 'player' && livesInHOA === true && !selectedHOA) ||
    (TENNIS_FEATURES_ENABLED && userRole === 'coach' && (!homeBase || sportsOffered.length === 0));

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0px 12px 32px rgba(15,31,61,0.04)',
        border: '1px solid rgba(15,31,61,0.06)',
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#0F1F3D',
          fontFamily: 'Manrope, sans-serif',
          marginBottom: 4,
          lineHeight: 1.2,
        }}
      >
        Create account
      </h1>
      <p style={{ fontSize: 14, color: '#8892A4', marginBottom: 24, fontFamily: 'Inter, sans-serif' }}>
        Join your community on TenisX
      </p>

      {error && (
        <div
          style={{
            background: '#FFF5F5',
            border: '1px solid #F97066',
            color: '#C0392B',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Role Selection */}
        <div>
          <label style={labelStyle}>
            I am a <span style={{ color: '#F97066' }}>*</span>
          </label>
          <Select value={userRole} onValueChange={(value: typeof userRole) => setUserRole(value)}>
            <SelectTrigger style={{ minHeight: 48, borderRadius: 8, borderColor: 'rgba(15,31,61,0.15)', fontFamily: 'Inter, sans-serif' }}>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="player">Resident</SelectItem>
              {TENNIS_FEATURES_ENABLED && (
                <SelectItem value="coach">Coach</SelectItem>
              )}
              <SelectItem value="hoa_manager">HOA Manager (requires verification)</SelectItem>
            </SelectContent>
          </Select>
          {userRole === 'hoa_manager' && (
            <p style={{ fontSize: 13, color: '#8892A4', marginTop: 6, fontFamily: 'Inter, sans-serif' }}>
              After creating your account, you'll be guided to submit verification documents.
            </p>
          )}
        </div>

        {/* HOA Question for Players */}
        {userRole === 'player' && (
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>
                Do you live in an HOA that uses this app? <span style={{ color: '#F97066' }}>*</span>
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    id="livesInHOA-yes"
                    name="livesInHOA"
                    value="yes"
                    checked={livesInHOA === true}
                    onChange={() => setLivesInHOA(true)}
                    style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
                  />
                  <label htmlFor="livesInHOA-yes" style={{ fontSize: 14, color: '#0F1F3D', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                    Yes, I live in an HOA
                  </label>
                </div>
                {TENNIS_FEATURES_ENABLED && (
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      id="livesInHOA-no"
                      name="livesInHOA"
                      value="no"
                      checked={livesInHOA === false}
                      onChange={() => setLivesInHOA(false)}
                      style={{ accentColor: '#00D4FF', width: 16, height: 16 }}
                    />
                    <label htmlFor="livesInHOA-no" style={{ fontSize: 14, color: '#0F1F3D', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                      No, I'm not part of an HOA
                    </label>
                  </div>
                )}
              </div>
            </div>

            {livesInHOA && (
              <div>
                <label style={labelStyle}>
                  Select Your Community <span style={{ color: '#F97066' }}>*</span>
                </label>
                <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading}>
                  <SelectTrigger style={{ minHeight: 48, borderRadius: 8, borderColor: 'rgba(15,31,61,0.15)', fontFamily: 'Inter, sans-serif' }}>
                    <SelectValue placeholder={loadingHOAs ? 'Loading communities…' : 'Choose your HOA'} />
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
              <div
                style={{
                  padding: 14,
                  background: '#E0F9FF',
                  borderRadius: 10,
                  borderLeft: '3px solid #00D4FF',
                }}
              >
                <p style={{ fontSize: 13, color: '#0369A1', fontFamily: 'Inter, sans-serif' }}>
                  You'll have access to tennis networking, coaching, competitive play, and public court discovery features.
                </p>
              </div>
            )}
          </div>
        )}

        {/* HOA Selection for Admins */}
        {userRole === 'admin' && (
          <div>
            <label style={labelStyle}>
              Select Your Community <span style={{ color: '#F97066' }}>*</span>
            </label>
            <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading}>
              <SelectTrigger style={{ minHeight: 48, borderRadius: 8, borderColor: 'rgba(15,31,61,0.15)', fontFamily: 'Inter, sans-serif' }}>
                <SelectValue placeholder={loadingHOAs ? 'Loading communities…' : 'Choose your HOA'} />
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
              <p style={{ fontSize: 13, color: '#F97066', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                HOA Admins must select a community to manage.
              </p>
            )}
          </div>
        )}

        {/* Full Name */}
        <div>
          <label htmlFor="fullName" style={labelStyle}>
            Full Name <span style={{ color: '#F97066' }}>*</span>
          </label>
          <input
            id="fullName"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isLoading}
            onFocus={() => setFocused('fullName')}
            onBlur={() => setFocused(null)}
            style={fieldStyle('fullName')}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="reg-email" style={labelStyle}>
            Email <span style={{ color: '#F97066' }}>*</span>
          </label>
          <input
            id="reg-email"
            type="email"
            placeholder="john.doe@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            onFocus={() => setFocused('reg-email')}
            onBlur={() => setFocused(null)}
            style={fieldStyle('reg-email')}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" style={labelStyle}>
            Password <span style={{ color: '#F97066' }}>*</span>
          </label>
          <input
            id="reg-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            onFocus={() => setFocused('reg-password')}
            onBlur={() => setFocused(null)}
            style={fieldStyle('reg-password')}
          />
        </div>

        {/* Coach-specific fields */}
        {TENNIS_FEATURES_ENABLED && userRole === 'coach' && (
          <>
            <div>
              <label htmlFor="businessName" style={labelStyle}>Coaching Business Name (optional)</label>
              <input
                id="businessName"
                type="text"
                placeholder="Elite Tennis Coaching"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={isLoading}
                onFocus={() => setFocused('businessName')}
                onBlur={() => setFocused(null)}
                style={fieldStyle('businessName')}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Coaching Credentials <span style={{ color: '#F97066' }}>*</span>
              </label>
              <Select value={credentials} onValueChange={(value: 'USPTA' | 'PTR' | 'None') => setCredentials(value)}>
                <SelectTrigger style={{ minHeight: 48, borderRadius: 8, borderColor: 'rgba(15,31,61,0.15)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USPTA">USPTA Certified</SelectItem>
                  <SelectItem value="PTR">PTR Certified</SelectItem>
                  <SelectItem value="None">No Formal Certification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="yearsExperience" style={labelStyle}>
                Years of Experience <span style={{ color: '#F97066' }}>*</span>
              </label>
              <input
                id="yearsExperience"
                type="number"
                min="0"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)}
                disabled={isLoading}
                onFocus={() => setFocused('yearsExperience')}
                onBlur={() => setFocused(null)}
                style={fieldStyle('yearsExperience')}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Sports Offered <span style={{ color: '#F97066' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-4">
                {['Tennis', 'Pickleball', 'Padel'].map((sport) => (
                  <div key={sport} className="flex items-center gap-2">
                    <Checkbox
                      id={sport}
                      checked={sportsOffered.includes(sport)}
                      onCheckedChange={(checked) => handleSportChange(sport, checked as boolean)}
                    />
                    <label htmlFor={sport} style={{ fontSize: 14, color: '#0F1F3D', cursor: 'pointer' }}>{sport}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="homeBase" style={labelStyle}>
                Home Base (City or Club) <span style={{ color: '#F97066' }}>*</span>
              </label>
              <input
                id="homeBase"
                type="text"
                placeholder="San Francisco, CA"
                value={homeBase}
                onChange={(e) => setHomeBase(e.target.value)}
                required
                disabled={isLoading}
                onFocus={() => setFocused('homeBase')}
                onBlur={() => setFocused(null)}
                style={fieldStyle('homeBase')}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="willingToTravel"
                checked={willingToTravel}
                onCheckedChange={(checked) => setWillingToTravel(checked as boolean)}
              />
              <label htmlFor="willingToTravel" style={{ fontSize: 14, color: '#0F1F3D', cursor: 'pointer' }}>
                Willing to travel to HOAs
              </label>
            </div>

            <div>
              <label htmlFor="hourlyRate" style={labelStyle}>Preferred Hourly Rate (USD, optional)</label>
              <input
                id="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                placeholder="75.00"
                value={hourlyRate || ''}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || undefined)}
                disabled={isLoading}
                onFocus={() => setFocused('hourlyRate')}
                onBlur={() => setFocused(null)}
                style={fieldStyle('hourlyRate')}
              />
            </div>

            <div>
              <label htmlFor="bio" style={labelStyle}>Bio (optional)</label>
              <Textarea
                id="bio"
                placeholder="Tell potential students about your coaching philosophy…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={isLoading}
                style={{
                  borderRadius: 8,
                  borderColor: focused === 'bio' ? '#00D4FF' : 'rgba(15,31,61,0.15)',
                  fontSize: 15,
                  fontFamily: 'Inter, sans-serif',
                  color: '#0F1F3D',
                }}
                onFocus={() => setFocused('bio')}
                onBlur={() => setFocused(null)}
              />
            </div>
          </>
        )}

        {/* Common non-coach fields */}
        {userRole !== 'coach' && (
          <>
            <div>
              <label htmlFor="phoneNumber" style={labelStyle}>Phone Number</label>
              <input
                id="phoneNumber"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading}
                onFocus={() => setFocused('phoneNumber')}
                onBlur={() => setFocused(null)}
                style={fieldStyle('phoneNumber')}
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" style={labelStyle}>Date of Birth</label>
              <input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={isLoading}
                onFocus={() => setFocused('dateOfBirth')}
                onBlur={() => setFocused(null)}
                style={fieldStyle('dateOfBirth')}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          style={{
            width: '100%',
            minHeight: 52,
            background: isSubmitDisabled ? '#8892A4' : '#0F1F3D',
            color: 'white',
            borderRadius: 8,
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Manrope, sans-serif',
            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            padding: '0 16px',
            transition: 'background 0.15s',
            marginTop: 8,
          }}
        >
          {isLoading ? 'Creating Account…' : 'Create Account'}
        </button>
      </form>

      <div
        style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid rgba(15,31,61,0.08)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 14, color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
