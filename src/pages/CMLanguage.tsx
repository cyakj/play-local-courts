import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { useToast } from '@/hooks/use-toast';

const CMLanguage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Language & Region</span>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] space-y-4">
          {[
            { label: 'Language', value: 'English (US)' },
            { label: 'Timezone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
            { label: 'Date Format', value: 'MM/DD/YYYY' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-[12px] font-bold text-[#9CA3AF]">{item.label}</p>
                <p className="text-sm font-medium text-[#0F1F3D] mt-0.5">{item.value}</p>
              </div>
              <button
                onClick={() => toast({ title: 'Coming Soon', description: 'This setting will be configurable in a future update.' })}
                className="text-[12px] font-bold text-[#00D4FF]"
              >
                Change
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CMLanguage;
