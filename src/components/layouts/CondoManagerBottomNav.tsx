import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, AlertTriangle, CalendarDays, MessageSquare } from 'lucide-react';
import { useCondoManagerCommunities, useCondoManagerAlerts } from '@/hooks/useCondoManagerData';

const CondoManagerBottomNav = () => {
  const location = useLocation();
  const { communities } = useCondoManagerCommunities();
  const { alerts } = useCondoManagerAlerts(communities);

  const alertCount = alerts.length;

  const navItems = [
    { path: '/cm', icon: LayoutGrid, label: 'Portfolio' },
    { path: '/cm/reports', icon: AlertTriangle, label: 'Issues' },
    { path: '/cm/calendar', icon: CalendarDays, label: 'Calendar' },
    { path: '/cm/messages', icon: MessageSquare, label: 'Messages', badge: alertCount },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(15,31,61,0.08)',
        paddingTop: 12,
        paddingBottom: 28,
      }}
    >
      <div className="flex justify-around items-center max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path ||
            (item.path === '/cm' && location.pathname.startsWith('/cm/community'));

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 min-h-[56px] min-w-[48px] justify-center"
            >
              <div className="relative">
                <Icon
                  className="h-[22px] w-[22px]"
                  style={{ color: active ? '#00D4FF' : '#8892A4' }}
                />
                {item.badge && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-extrabold">
                    {item.badge}
                  </div>
                )}
              </div>
              <span
                className="text-[12px] font-bold uppercase tracking-wide"
                style={{ color: active ? '#00D4FF' : '#8892A4' }}
              >
                {item.label}
              </span>
              {active ? (
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#00D4FF' }} />
              ) : (
                <div className="w-1 h-1" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default CondoManagerBottomNav;
