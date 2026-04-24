import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, ClipboardList, CalendarDays, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const BottomNavigation = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) return null;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/book', icon: Calendar, label: 'Book' },
    { path: '/my-reports', icon: ClipboardList, label: 'Reports' },
    { path: '/community-calendar', icon: CalendarDays, label: 'Calendar' },
    { path: '/documents', icon: FileText, label: 'Docs' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path;
  };

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
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 min-h-[56px] min-w-[48px] justify-center"
            >
              <Icon
                className="h-[22px] w-[22px]"
                style={{ color: active ? '#00D4FF' : '#8892A4' }}
              />
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

export default BottomNavigation;
