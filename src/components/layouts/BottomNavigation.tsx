
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, ClipboardList, Settings, CalendarDays } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';

const BottomNavigation = () => {
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (!currentUser) {
    return null;
  }

  const navItems = [
    {
      path: '/',
      icon: Home,
      label: 'Home',
    },
    {
      path: '/reserve-court',
      icon: Calendar,
      label: 'Book',
    },
    {
      path: '/my-reports',
      icon: ClipboardList,
      label: 'Reports',
    },
  ];

  // Admin tab - only for HOA admins
  if (isAdmin) {
    navItems.push({
      path: '/admin',
      icon: Settings,
      label: 'Admin',
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border z-50 safe-area-pb">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] justify-center"
            >
              <div className={`
                p-2 rounded-xl transition-all duration-200
                ${active 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-medium transition-all duration-200 ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
