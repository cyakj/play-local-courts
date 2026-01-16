import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Lock, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProfileFormData } from '@/hooks/useSettingsForm';

interface AccountSectionProps {
  profile: ProfileFormData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileFormData>>;
}

const AccountSection: React.FC<AccountSectionProps> = ({ profile, setProfile }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(profile.phoneNumber);
  const [savingPhone, setSavingPhone] = useState(false);

  const handleSavePhone = async () => {
    if (!currentUser) return;
    
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: phoneInput || null })
        .eq('id', currentUser.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, phoneNumber: phoneInput }));
      setEditingPhone(false);
      toast({ title: "Phone number updated" });
    } catch (error) {
      console.error('Error updating phone:', error);
      toast({ 
        title: "Error", 
        description: "Failed to update phone number",
        variant: "destructive" 
      });
    } finally {
      setSavingPhone(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for the password reset link"
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset email",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Account Details</CardTitle>
        <CardDescription>Manage your account information and security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email */}
        <div className="flex items-center justify-between py-4 border-b">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Email Address</Label>
              <p className="font-medium">{currentUser?.email || 'Not set'}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Cannot be changed
          </span>
        </div>

        {/* Phone */}
        <div className="flex items-center justify-between py-4 border-b">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-3 bg-muted rounded-xl">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground">Phone Number</Label>
              {editingPhone ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="max-w-[200px]"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={handleSavePhone}
                    disabled={savingPhone}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => {
                      setEditingPhone(false);
                      setPhoneInput(profile.phoneNumber);
                    }}
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <p className="font-medium">{profile.phoneNumber || 'Not set'}</p>
              )}
            </div>
          </div>
          {!editingPhone && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setPhoneInput(profile.phoneNumber);
                setEditingPhone(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {/* Password */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Password</Label>
              <p className="font-medium">••••••••••••</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handlePasswordReset}>
            Reset Password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountSection;
