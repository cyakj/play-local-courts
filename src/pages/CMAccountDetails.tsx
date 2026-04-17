import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CMAccountDetails = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPhone, setTempPhone] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || '');
      setTempEmail(data?.user?.email || '');
    });
    supabase.from('profiles').select('phone_number').eq('id', currentUser.id).single().then(({ data }) => {
      setPhone(data?.phone_number || '');
      setTempPhone(data?.phone_number || '');
    });
  }, [currentUser]);

  const handlePasswordReset = async () => {
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Password Reset Email Sent', description: 'Check your email for the reset link.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to send reset email', variant: 'destructive' });
    }
  };

  const handleSavePhone = async () => {
    if (!currentUser) return;
    const { error } = await supabase.from('profiles').update({ phone_number: tempPhone || null }).eq('id', currentUser.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update phone', variant: 'destructive' });
    } else {
      setPhone(tempPhone);
      setEditingPhone(false);
      toast({ title: 'Phone updated' });
    }
  };

  const Row = ({ icon: Icon, label, value, editing, onEdit, onCancel, onSave, editValue, onEditChange, actionLabel }: any) => (
    <div className="py-4 border-b border-[#E5E7EB] last:border-0">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#F9FAFB] rounded-lg mt-0.5">
          <Icon className="h-4 w-4 text-[#4B5563]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-[#9CA3AF]">{label}</p>
          {editing ? (
            <div className="mt-1.5 space-y-2">
              <input
                value={editValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditChange(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/30"
              />
              <div className="flex gap-2">
                <button onClick={onSave} className="px-4 py-1.5 rounded-lg bg-[#00D4FF] text-white text-xs font-bold">Save</button>
                <button onClick={onCancel} className="px-4 py-1.5 rounded-lg bg-[#F9FAFB] text-[#9CA3AF] text-xs font-semibold">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-[#0F1F3D] mt-0.5">{value || '—'}</p>
          )}
        </div>
        {!editing && onEdit && (
          <button onClick={onEdit} className="text-[12px] font-bold text-[#00D4FF] mt-1">{actionLabel || 'Edit'}</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <span className="text-xl font-extrabold block">Account Details</span>
            <span className="text-[11px] text-white/60">Manage your account information</span>
          </div>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        <div className="bg-white rounded-2xl px-5 border border-[#E5E7EB]">
          <Row icon={Mail} label="Email Address" value={email} editing={editingEmail}
            editValue={tempEmail} onEditChange={setTempEmail}
            onEdit={() => setEditingEmail(true)} onCancel={() => { setEditingEmail(false); setTempEmail(email); }}
            onSave={() => { setEditingEmail(false); }} actionLabel="Edit" />
          <Row icon={Phone} label="Phone Number" value={phone} editing={editingPhone}
            editValue={tempPhone} onEditChange={setTempPhone}
            onEdit={() => setEditingPhone(true)} onCancel={() => { setEditingPhone(false); setTempPhone(phone); }}
            onSave={handleSavePhone} actionLabel="Edit" />
          <div className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#F9FAFB] rounded-lg mt-0.5">
                <Lock className="h-4 w-4 text-[#4B5563]" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-[#9CA3AF]">Password</p>
                <p className="text-sm font-medium text-[#0F1F3D] mt-0.5">••••••••••••</p>
              </div>
              <button onClick={handlePasswordReset} className="text-[12px] font-bold text-[#00D4FF] mt-1">Reset Password</button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <p className="text-[11px] font-bold text-[#9CA3AF] tracking-wider px-1 mb-2">DANGER ZONE</p>
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
            <button className="text-[12px] font-bold text-[#EF4444]">Delete Account</button>
            <p className="text-[11px] text-[#9CA3AF] mt-1">Permanently delete your account and all data</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CMAccountDetails;
