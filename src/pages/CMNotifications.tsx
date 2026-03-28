import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Users, CalendarCheck, Megaphone } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { useToast } from '@/hooks/use-toast';

interface NotifCategory {
  title: string;
  icon: React.ElementType;
  items: { key: string; label: string; defaultPush: boolean; defaultEmail: boolean }[];
}

const categories: NotifCategory[] = [
  {
    title: 'Reports & Issues',
    icon: Wrench,
    items: [
      { key: 'new_report', label: 'New report submitted', defaultPush: true, defaultEmail: true },
      { key: 'report_status', label: 'Report status changed', defaultPush: true, defaultEmail: true },
      { key: 'urgent_only', label: 'Urgent reports only mode', defaultPush: false, defaultEmail: false },
    ],
  },
  {
    title: 'Members',
    icon: Users,
    items: [
      { key: 'new_member', label: 'New member application', defaultPush: true, defaultEmail: true },
      { key: 'member_confirm', label: 'Member approved/rejected', defaultPush: false, defaultEmail: false },
    ],
  },
  {
    title: 'Bookings',
    icon: CalendarCheck,
    items: [
      { key: 'booking_cancel', label: 'Booking cancellations', defaultPush: true, defaultEmail: true },
      { key: 'daily_summary', label: 'Daily booking summary', defaultPush: false, defaultEmail: false },
    ],
  },
  {
    title: 'Community',
    icon: Megaphone,
    items: [
      { key: 'announcements', label: 'Announcements posted', defaultPush: true, defaultEmail: true },
      { key: 'survey_milestone', label: 'Survey 50% responded', defaultPush: false, defaultEmail: false },
    ],
  },
];

const CMNotifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, { push: boolean; email: boolean }>>(() => {
    const initial: Record<string, { push: boolean; email: boolean }> = {};
    categories.forEach(cat => cat.items.forEach(item => {
      initial[item.key] = { push: item.defaultPush, email: item.defaultEmail };
    }));
    return initial;
  });

  const toggle = (key: string, channel: 'push' | 'email') => {
    setPrefs(p => ({
      ...p,
      [key]: { ...p[key], [channel]: !p[key][channel] },
    }));
    toast({
      title: 'Saved',
      duration: 1500,
    });
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
                {cat.items.map((item, idx) => (
                  <div
                    key={item.key}
                    className="py-3.5"
                    style={idx > 0 ? { borderTop: '1px solid #F3F4F6' } : undefined}
                  >
                    <span className="text-[13px] font-semibold text-[#1A1A2E] block mb-2">
                      {item.label}
                    </span>
                    <div className="flex gap-2">
                      {/* Push chip */}
                      <button
                        onClick={() => toggle(item.key, 'push')}
                        className="min-h-[44px] flex items-center gap-1.5 rounded-full transition-all"
                        style={
                          prefs[item.key]?.push
                            ? {
                                background: '#E0F7FA',
                                border: '1.5px solid #00B4D8',
                                padding: '6px 14px',
                                color: '#00B4D8',
                                fontWeight: 700,
                                fontSize: '12px',
                              }
                            : {
                                background: '#F3F4F6',
                                border: '1.5px solid #E5E7EB',
                                padding: '6px 14px',
                                color: '#9CA3AF',
                                fontWeight: 600,
                                fontSize: '12px',
                              }
                        }
                      >
                        <span>📱</span>
                        <span>Push</span>
                        <span>{prefs[item.key]?.push ? '✓' : '—'}</span>
                      </button>

                      {/* Email chip */}
                      <button
                        onClick={() => toggle(item.key, 'email')}
                        className="min-h-[44px] flex items-center gap-1.5 rounded-full transition-all"
                        style={
                          prefs[item.key]?.email
                            ? {
                                background: '#E0F7FA',
                                border: '1.5px solid #00B4D8',
                                padding: '6px 14px',
                                color: '#00B4D8',
                                fontWeight: 700,
                                fontSize: '12px',
                              }
                            : {
                                background: '#F3F4F6',
                                border: '1.5px solid #E5E7EB',
                                padding: '6px 14px',
                                color: '#9CA3AF',
                                fontWeight: 600,
                                fontSize: '12px',
                              }
                        }
                      >
                        <span>📧</span>
                        <span>Email</span>
                        <span>{prefs[item.key]?.email ? '✓' : '—'}</span>
                      </button>
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
