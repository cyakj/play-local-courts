
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, ClipboardList, CalendarDays } from 'lucide-react';
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
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50" style={{ paddingTop: 10, paddingBottom: 20 }}>
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center"
            >
              <Icon
                className="h-5 w-5"
                style={{
                  color: active ? '#4B5563' : '#9CA3AF',
                  filter: 'grayscale(1)',
                  opacity: active ? 1 : 0.45,
                }}
              />
              <span
                className="text-[10px] font-bold"
                style={{ color: active ? '#1A1A2E' : '#9CA3AF' }}
              >
                {item.label}
              </span>
              {active ? (
                <div className="w-5 h-[3px] rounded-full" style={{ background: '#00B4D8' }} />
              ) : (
                <div className="w-5 h-[3px]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
