import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const EditProfile = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone_number, avatar_url, unit_number')
        .eq('id', currentUser.id)
        .single();
      if (data) {
        const parts = (data.full_name || '').split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
        setPhone((data as any).phone_number || '');
        setAvatarUrl((data as any).avatar_url || null);
        setUnitNumber((data as any).unit_number || '');
      }
      setEmail(currentUser.email || '');
      setLoading(false);
    })();
  }, [currentUser]);

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentUser.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('id', currentUser.id);
      toast({ title: 'Photo updated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to upload photo', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone_number: phone, unit_number: unitNumber || null } as any)
        .eq('id', currentUser.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      navigate(-1);
    } catch {
      toast({ title: 'Error', description: 'Failed to save profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00B4D8', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F0F4F8' }}>
      {/* Navy Header */}
      <div className="text-white px-5 pt-[50px] pb-5" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2137 60%, #1A3350 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Edit Profile</span>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-5">
        {/* Avatar */}
        <div className="flex justify-center">
          <label className="relative cursor-pointer">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold text-white overflow-hidden"
              style={{ background: '#0A1628', border: '2px solid #00B4D8' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: '#00B4D8', border: '2px solid #F0F4F8' }}
            >
              <Camera className="h-3 w-3 text-white" />
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <FieldLabel label="First Name">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full text-sm"
              style={inputStyle}
            />
          </FieldLabel>

          <FieldLabel label="Last Name">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full text-sm"
              style={inputStyle}
            />
          </FieldLabel>

          <FieldLabel label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm"
              style={inputStyle}
            />
          </FieldLabel>

          <FieldLabel label="Phone (optional)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full text-sm"
              style={inputStyle}
            />
          </FieldLabel>

          <FieldLabel label="Unit Number">
            <div className="relative">
              <input
                type="text"
                value={unitNumber}
                readOnly
                className="w-full text-sm pr-10"
                style={{ ...inputStyle, background: '#F9FAFB', color: '#9CA3AF', cursor: 'not-allowed' }}
              />
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
            </div>
          </FieldLabel>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl text-white text-[15px] font-extrabold disabled:opacity-50"
          style={{ background: '#0A1628' }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  padding: '12px 14px',
  outline: 'none',
  fontSize: 14,
  color: '#1A1A2E',
};

const FieldLabel: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold mb-2" style={{ color: '#4B5563' }}>{label}</label>
    {children}
  </div>
);

export default EditProfile;
