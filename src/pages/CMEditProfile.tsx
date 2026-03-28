import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CMEditProfile = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    professionalTitle: '',
    companyName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (!currentUser) return;
    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      const nameParts = (data?.full_name || '').split(' ');
      const { data: authData } = await supabase.auth.getUser();
      setForm({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        professionalTitle: data?.bio || '',
        companyName: '',
        email: authData?.user?.email || '',
        phone: data?.phone_number || '',
      });
    };
    loadProfile();
  }, [currentUser]);

  const initials = `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`.toUpperCase() || '?';

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        phone_number: form.phone || null,
        bio: form.professionalTitle || null,
        updated_at: new Date().toISOString(),
      }).eq('id', currentUser.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      navigate(-1);
    } catch {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, type = 'text', disabled = false }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean;
  }) => (
    <div>
      <label className="text-[12px] font-bold text-[#4B5563] mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3.5 py-3 rounded-[10px] border border-[#E5E7EB] text-sm text-[#1A1A2E] bg-white disabled:bg-[#F0F4F8] disabled:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8]"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Edit Profile</span>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold text-white" style={{ background: '#0A1628', border: '3px solid #00B4D8' }}>
              {initials}
            </div>
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#00B4D8] flex items-center justify-center border-2 border-white">
              <Camera className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] space-y-4">
          <Field label="First Name" value={form.firstName} onChange={(v) => setForm(f => ({ ...f, firstName: v }))} />
          <Field label="Last Name" value={form.lastName} onChange={(v) => setForm(f => ({ ...f, lastName: v }))} />
          <Field label="Professional Title" value={form.professionalTitle} onChange={(v) => setForm(f => ({ ...f, professionalTitle: v }))} />
          <Field label="Company / Business Name" value={form.companyName} onChange={(v) => setForm(f => ({ ...f, companyName: v }))} />
          <Field label="Email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} type="email" disabled />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} type="tel" />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-[12px] text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #00B4D8 0%, #0095B6 100%)' }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default CMEditProfile;
