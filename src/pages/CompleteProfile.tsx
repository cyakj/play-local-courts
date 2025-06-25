
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { isAdminEmail } from '../config/adminEmails';
import { UserRole, UserStatus } from '../types';

interface HOA {
  id: string;
  name: string;
  community_type: string;
  address?: string;
}

const CompleteProfile = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedHOA, setSelectedHOA] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hoas, setHOAs] = useState<HOA[]>([]);
  const [loadingHOAs, setLoadingHOAs] = useState(true);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user already has complete profile
    if (currentUser?.hoa_id) {
      navigate('/dashboard');
      return;
    }
    
    loadHOAs();
  }, [currentUser, navigate]);

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

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedHOA) {
      toast.error('Please select an HOA');
      return;
    }

    if (!currentUser) {
      toast.error('No user found');
      return;
    }

    setIsLoading(true);
    
    try {
      const shouldBeAdmin = isAdminEmail(currentUser.email || '');
      const userRole = shouldBeAdmin ? UserRole.ADMIN : UserRole.RESIDENT;
      const userStatus = shouldBeAdmin ? UserStatus.APPROVED : UserStatus.PENDING;

      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: phoneNumber || null,
          date_of_birth: dateOfBirth || null,
          hoa_id: selectedHOA,
          hoa_role: userRole,
          hoa_status: userStatus,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      toast.success('Profile completed successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error completing profile:', err);
      toast.error(err.message || 'Failed to complete profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            <CardDescription>
              Please provide additional information to complete your account setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hoa">Select Your Community *</Label>
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

              <Button type="submit" className="w-full" disabled={isLoading || !selectedHOA}>
                {isLoading ? 'Completing Profile...' : 'Complete Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;
