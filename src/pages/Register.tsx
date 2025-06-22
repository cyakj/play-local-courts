
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllHOAs } from '../services/supabaseService';
import { isAdminEmail } from '../config/adminEmails';
import { HOA } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import CommunitySelection from '../components/CommunitySelection';
import CommunityCreationForm from '../components/CommunityCreationForm';

const Register = () => {
  const [step, setStep] = useState<'personal' | 'community' | 'create'>('personal');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedHOAId, setSelectedHOAId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { register } = useAuth();

  // Check if current email is an admin email
  const willBeAdmin = isAdminEmail(email);

  const handlePersonalInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setStep('community');
  };

  const handleJoinExisting = (hoaId: string) => {
    setSelectedHOAId(hoaId);
    handleRegister(hoaId);
  };

  const handleCreateNew = () => {
    setStep('create');
  };

  const handleCommunityCreated = (communityId: string) => {
    setSelectedHOAId(communityId);
    handleRegister(communityId);
  };
  
  const handleRegister = async (hoaId: string) => {
    setError('');
    setIsLoading(true);
    
    try {
      await register(
        fullName, 
        email, 
        password, 
        phoneNumber || undefined, 
        dateOfBirth || undefined, 
        hoaId
      );
    } catch (err: any) {
      setError(err.message || 'Failed to register');
      setStep('personal'); // Go back to personal info step on error
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'personal') {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join your community's court reservation system</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {willBeAdmin && email && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
              <strong>Admin Account Detected:</strong> This email will be granted administrator privileges with full system access.
            </div>
          )}

          <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            
            <Button type="submit" className="w-full">
              Continue
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
  }

  if (step === 'community') {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setStep('personal')}
          className="mb-4"
        >
          ← Back to personal info
        </Button>
        <CommunitySelection
          onJoinExisting={handleJoinExisting}
          onCreateNew={handleCreateNew}
        />
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setStep('community')}
          className="mb-4"
        >
          ← Back to community selection
        </Button>
        <CommunityCreationForm
          onCommunityCreated={handleCommunityCreated}
          onBack={() => setStep('community')}
        />
      </div>
    );
  }

  return null;
};

export default Register;
