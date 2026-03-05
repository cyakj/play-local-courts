import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Settings } from 'lucide-react';
import { Button } from './button';

const Navbar = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  return (
    <nav className="bg-background/80 backdrop-blur-lg shadow-sm border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <Home className="h-4 w-4 text-white" />
              </div>
            </Link>
          </div>
          <div className="flex items-center">
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
