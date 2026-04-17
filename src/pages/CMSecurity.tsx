import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Smartphone, Clock } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const CMSecurity = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Security</span>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* 2FA */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#F9FAFB] rounded-lg">
                <Shield className="h-4 w-4 text-[#4B5563]" />
              </div>
              <div>
                <p className="font-bold text-[14px] text-[#0F1F3D]">Two-Factor Authentication</p>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Add an extra layer of security</p>
              </div>
            </div>
            <Switch
              checked={false}
              onCheckedChange={() => toast({ title: 'Coming Soon', description: '2FA will be available in a future update.' })}
              className="data-[state=checked]:bg-[#00D4FF]"
            />
          </div>
          <div className="mt-3 ml-11">
            <span className="text-[11px] font-semibold text-[#9CA3AF] bg-[#F9FAFB] px-2.5 py-1 rounded-full">Not enabled</span>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#F9FAFB] rounded-lg">
              <Smartphone className="h-4 w-4 text-[#4B5563]" />
            </div>
            <p className="font-bold text-[14px] text-[#0F1F3D]">Active Sessions</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#F9FAFB]">
              <div>
                <p className="text-[13px] font-semibold text-[#0F1F3D]">Current Device</p>
                <p className="text-[11px] text-[#9CA3AF]">Web Browser • Active now</p>
              </div>
              <span className="text-[10px] font-bold text-[#00D4FF] bg-[#00D4FF]/10 px-2 py-0.5 rounded-full">This device</span>
            </div>
          </div>
          <button className="mt-4 w-full py-2.5 rounded-[10px] border border-[#EF4444]/20 text-[13px] font-bold text-[#EF4444]">
            Sign Out All Other Devices
          </button>
        </div>

        {/* Last Password Change */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F9FAFB] rounded-lg">
              <Clock className="h-4 w-4 text-[#4B5563]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#0F1F3D]">Last Password Change</p>
              <p className="text-[11px] text-[#9CA3AF]">Never changed</p>
            </div>
            <button
              onClick={() => navigate('/cm/settings/account')}
              className="text-[12px] font-bold text-[#00D4FF]"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CMSecurity;
