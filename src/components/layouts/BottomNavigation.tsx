
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  Settings,
  Plus,
  Users,
  Trophy,
  FileText,
  Megaphone,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMode } from '../../contexts/ModeContext';
import { UserType } from '../../types';

const BottomNavigation = () => {
  const { currentUser, isAdmin } = useAuth();
  const { triggerTennisComingSoon } = useMode();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  if (!currentUser) return null;

  // ─── HOA navigation (the only shippable mode right now) ──────────────────
  // Note: Tennis court booking (/reserve-court) is intentionally kept here
  // because courts are an HOA amenity — not the global TennisX product.
  const hoaNavItems = [
    { path: '/',               icon: Home,       label: 'Home',        color: 'text-green-600' },
    { path: '/reserve-court',  icon: Plus,       label: 'Reserve',     color: 'text-teal-600',   isSpecial: true },
    { path: '/upcoming',       icon: Calendar,   label: 'Upcoming',    color: 'text-blue-600' },
    { path: '/my-locker',      icon: Users,      label: 'Profile',   color: 'text-indigo-600' },
  ];

  // NON_HOA users still get the same HOA-first layout (reserve facilities link)
  const nonHoaNavItems = [
    { path: '/',                    icon: Home,     label: 'Home',      color: 'text-green-600' },
    { path: '/reserve-facilities',  icon: Plus,     label: 'Reserve',   color: 'text-teal-600',  isSpecial: true },
    { path: '/upcoming',            icon: Calendar, label: 'Upcoming',  color: 'text-blue-600' },
    { path: '/my-locker',           icon: Users,    label: 'Profile', color: 'text-indigo-600' },
  ];

  const baseItems =
    currentUser.userType === UserType.NON_HOA ? nonHoaNavItems : hoaNavItems;

  if (isAdmin) {
    baseItems.push({ path: '/admin', icon: Settings, label: 'Admin', color: 'text-red-600' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {/* Regular nav items */}
        {baseItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-300 hover:scale-110 ${
                item.isSpecial ? 'transform hover:scale-125' : ''
              }`}
            >
              <div
                className={`
                  relative p-2 rounded-xl transition-all duration-300
                  ${active
                    ? `${item.color} bg-current/10 shadow-lg scale-110`
                    : 'text-gray-400 hover:text-gray-600'
                  }
                  ${item.isSpecial
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg hover:shadow-xl'
                    : ''
                  }
                `}
              >
                <Icon className={`h-6 w-6 ${item.isSpecial ? 'text-white' : ''}`} />
                {active && !item.isSpecial && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-current rounded-full animate-pulse" />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-all duration-300 ${
                  active ? item.color : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Tennis "Compete" tab — gated behind Coming Soon */}
        <button
          onClick={triggerTennisComingSoon}
          className="flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-300 hover:scale-110 relative"
          aria-label="Tennis Compete — Coming Soon"
        >
          <div className="relative p-2 rounded-xl text-gray-300">
            <Trophy className="h-6 w-6" />
            {/* "Soon" badge */}
            <span className="absolute -top-1 -right-1 text-[9px] font-bold text-amber-500 bg-amber-50 border border-amber-200 rounded-full px-1 leading-tight">
              Soon
            </span>
          </div>
          <span className="text-xs font-medium text-gray-300">Compete</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavigation;
