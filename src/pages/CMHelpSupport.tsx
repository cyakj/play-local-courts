import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, HelpCircle, FileText, ShieldCheck, ChevronRight } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';

const CMHelpSupport = () => {
  const navigate = useNavigate();

  const items = [
    { icon: Mail, label: 'Contact Us', desc: 'Get in touch with our support team', action: () => window.open('mailto:support@tenisx.com') },
    { icon: HelpCircle, label: 'FAQ', desc: 'Frequently asked questions', action: () => navigate('/faq') },
    { icon: FileText, label: 'Terms of Service', desc: 'Read our terms and conditions', action: () => navigate('/terms') },
    { icon: ShieldCheck, label: 'Privacy Policy', desc: 'How we handle your data', action: () => navigate('/privacy') },
  ];

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <span className="text-xl font-extrabold block">Help & Support</span>
            <span className="text-[11px] text-white/60">Get help and review policies</span>
          </div>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#F0F4F8] transition-colors min-h-[52px] ${
                  idx < items.length - 1 ? 'border-b border-[#E5E7EB]' : ''
                }`}
              >
                <div className="p-2 bg-[#F0F4F8] rounded-lg">
                  <Icon className="h-4 w-4 text-[#4B5563]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-[#1A1A2E]">{item.label}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CMHelpSupport;
