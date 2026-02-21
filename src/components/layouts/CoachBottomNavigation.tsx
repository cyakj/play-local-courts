import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, GraduationCap, Star, Users, User, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMode } from '../../contexts/ModeContext';

const CoachBottomNavigation = () => {
  const { currentUser } = useAuth();
  const { triggerTennisComingSoon } = useMode();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  if (!currentUser) return null;

  const navItems = [
    { path: '/coach-dashboard', icon: GraduationCap, label: 'Dashboard', color: 'text-green-600' },
    { path: '/coach-schedule',  icon: Calendar,      label: 'Schedule',  color: 'text-blue-600' },
    { path: '/email-settings',  icon: User,          label: 'Profile',   color: 'text-gray-600' },
    { path: '/coach-reviews',   icon: Star,          label: 'Reviews',   color: 'text-yellow-600' },
    { path: '/coach-clients',   icon: Users,         label: 'Clients',   color: 'text-purple-600' },
  ];

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
              className="flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-300 hover:scale-110"
            >
              <div
                className={`
                  relative p-2 rounded-xl transition-all duration-300
                  ${active
                    ? `${item.color} bg-current/10 shadow-lg scale-110`
                    : 'text-gray-400 hover:text-gray-600'
                  }
                `}
              >
                <Icon className="h-6 w-6" />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-current rounded-full animate-pulse" />
                )}
              </div>
              <span className={`text-xs font-medium transition-all duration-300 ${active ? item.color : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Compete (manage-ladders) — Coming Soon for coaches too */}
        <button
          onClick={triggerTennisComingSoon}
          className="flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-300 hover:scale-110"
          aria-label="Compete — Coming Soon"
        >
          <div className="relative p-2 rounded-xl text-gray-300">
            <Trophy className="h-6 w-6" />
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

export default CoachBottomNavigation;
