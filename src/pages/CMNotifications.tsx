import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Users, CalendarCheck, Megaphone } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { Switch } from '@/components/ui/switch';

interface NotifCategory {
  title: string;
  icon: React.ElementType;
  items: { key: string; label: string; defaultOn: boolean }[];
}

const categories: NotifCategory[] = [
  {
    title: 'Reports & Issues',
    icon: Wrench,
    items: [
      { key: 'new_report', label: 'New report submitted', defaultOn: true },
      { key: 'report_status', label: 'Report status changed', defaultOn: true },
      { key: 'urgent_only', label: 'Urgent reports only mode', defaultOn: false },
    ],
  },
  {
    title: 'Members',
    icon: Users,
    items: [
      { key: 'new_member', label: 'New member application', defaultOn: true },
      { key: 'member_confirm', label: 'Member approved/rejected', defaultOn: false },
    ],
  },
  {
    title: 'Bookings',
    icon: CalendarCheck,
    items: [
      { key: 'booking_cancel', label: 'Booking cancellations', defaultOn: true },
      { key: 'daily_summary', label: 'Daily booking summary', defaultOn: false },
    ],
  },
  {
    title: 'Community',
    icon: Megaphone,
    items: [
      { key: 'announcements', label: 'Announcements posted', defaultOn: true },
      { key: 'survey_milestone', label: 'Survey 50% responded', defaultOn: false },
    ],
  },
];

const CMNotifications = () => {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Record<string, { push: boolean; email: boolean }>>(() => {
    const initial: Record<string, { push: boolean; email: boolean }> = {};
    categories.forEach(cat => cat.items.forEach(item => {
      initial[item.key] = { push: item.defaultOn, email: item.defaultOn };
    }));
    return initial;
  });

  const toggle = (key: string, channel: 'push' | 'email') => {
    setPrefs(p => ({
      ...p,
      [key]: { ...p[key], [channel]: !p[key][channel] },
    }));
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <span className="text-xl font-extrabold block">Notifications</span>
            <span className="text-[11px] text-white/60">Control what you're notified about</span>
          </div>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.title} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
              <div className="flex items-center gap-3 px-5 pt-4 pb-2">
                <div className="p-1.5 bg-[#F0F4F8] rounded-lg">
                  <Icon className="h-4 w-4 text-[#4B5563]" />
                </div>
                <p className="font-bold text-[14px] text-[#1A1A2E]">{cat.title}</p>
              </div>
              <div className="px-5 pb-4">
                {/* Column headers */}
                <div className="flex items-center justify-end gap-4 mb-1 pr-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] w-10 text-center">📱</span>
                  <span className="text-[10px] font-bold text-[#9CA3AF] w-10 text-center">📧</span>
                </div>
                {cat.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2.5 border-t border-[#F0F4F8]">
                    <span className="text-[13px] font-medium text-[#1A1A2E] flex-1">{item.label}</span>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={prefs[item.key]?.push}
                        onCheckedChange={() => toggle(item.key, 'push')}
                        className="data-[state=checked]:bg-[#00B4D8] scale-90"
                      />
                      <Switch
                        checked={prefs[item.key]?.email}
                        onCheckedChange={() => toggle(item.key, 'email')}
                        className="data-[state=checked]:bg-[#00B4D8] scale-90"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CMNotifications;
