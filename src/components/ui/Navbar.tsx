import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMode } from '../../contexts/ModeContext';
import { Home, Trophy } from 'lucide-react';

const Navbar = () => {
  const { currentUser } = useAuth();
  const { triggerTennisComingSoon } = useMode();

  if (!currentUser) {
    return null;
  }

  return (
    <nav className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Home logo + Mode Switcher */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center space-x-2 group shrink-0">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <Home className="h-4 w-4 text-white" />
              </div>
            </Link>

            {/* Mode Switcher */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              {/* HOA — active */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg shadow-sm cursor-default select-none">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-semibold text-gray-800 leading-none">HOA</span>
              </div>

              {/* Tennis — Coming Soon */}
              <button
                onClick={triggerTennisComingSoon}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer select-none transition-colors hover:bg-white/60 group"
                aria-label="Tennis — Coming Soon"
              >
                <Trophy className="h-3 w-3 text-gray-400 group-hover:text-gray-500 shrink-0" />
                <span className="text-xs font-medium text-gray-400 group-hover:text-gray-500 leading-none">
                  Tennis
                </span>
                <span className="hidden sm:inline text-[10px] font-semibold text-amber-500 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none ml-0.5">
                  Soon
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
