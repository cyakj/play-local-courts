import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, AlertTriangle, CalendarDays, Bell } from 'lucide-react';
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
    { path: '/cm/alerts', icon: Bell, label: 'Alerts', badge: alertCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-border z-50 safe-area-pb">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path || 
            (item.path === '/cm' && location.pathname.startsWith('/cm/community'));

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] justify-center relative"
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-colors ${active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                {item.badge && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-extrabold">
                    {item.badge}
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-bold transition-colors ${active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
              {active && <div className="w-5 h-[3px] rounded-full bg-emerald-600" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default CondoManagerBottomNav;
