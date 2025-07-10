
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, User, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';

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
      path: '/dashboard',
      icon: Home,
      label: 'Home',
      color: 'text-green-600'
    },
    {
      path: '/upcoming',
      icon: Calendar,
      label: 'Schedule',
      color: 'text-blue-600'
    },
    {
      path: '/reserve-court',
      icon: Plus,
      label: 'Reserve',
      color: 'text-purple-600',
      isSpecial: true
    },
    {
      path: '/my-locker',
      icon: User,
      label: 'My Locker',
      color: 'text-orange-600'
    }
  ];

  if (isAdmin) {
    navItems.push({
      path: '/admin',
      icon: Settings,
      label: 'Admin',
      color: 'text-red-600'
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-300 hover:scale-110 ${
                item.isSpecial 
                  ? 'transform hover:scale-125' 
                  : ''
              }`}
            >
              <div className={`
                relative p-2 rounded-xl transition-all duration-300
                ${active 
                  ? `${item.color} bg-current/10 shadow-lg scale-110` 
                  : 'text-gray-400 hover:text-gray-600'
                }
                ${item.isSpecial 
                  ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg hover:shadow-xl' 
                  : ''
                }
              `}>
                <Icon className={`h-6 w-6 ${item.isSpecial ? 'text-white' : ''}`} />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-current rounded-full animate-pulse" />
                )}
              </div>
              <span className={`text-xs font-medium transition-all duration-300 ${
                active ? item.color : 'text-gray-400'
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
