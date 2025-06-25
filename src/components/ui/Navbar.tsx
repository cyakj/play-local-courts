
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Home, Calendar, Users, Settings, User, Bell, Menu, X, Shield } from 'lucide-react';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <nav className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <Home className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                HOA Amenities
              </span>
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-2">
            <Link to="/dashboard">
              <Button 
                variant={isActive('/dashboard') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            
            <Link to="/upcoming">
              <Button 
                variant={isActive('/upcoming') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
              >
                <Calendar className="h-4 w-4" />
                Upcoming
              </Button>
            </Link>

            <Link to="/my-locker">
              <Button 
                variant={isActive('/my-locker') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
              >
                <User className="h-4 w-4" />
                My Locker
              </Button>
            </Link>

            {currentUser.role === 'admin' && (
              <>
                <Link to="/pending-requests">
                  <Button 
                    variant={isActive('/pending-requests') ? 'default' : 'ghost'} 
                    size="sm"
                    className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
                  >
                    <Users className="h-4 w-4" />
                    Pending
                  </Button>
                </Link>
                
                <Link to="/manage-amenities">
                  <Button 
                    variant={isActive('/manage-amenities') ? 'default' : 'ghost'} 
                    size="sm"
                    className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
                  >
                    <Settings className="h-4 w-4" />
                    Manage
                  </Button>
                </Link>

                <Link to="/amenity-rules">
                  <Button 
                    variant={isActive('/amenity-rules') ? 'default' : 'ghost'} 
                    size="sm"
                    className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
                  >
                    <Shield className="h-4 w-4" />
                    Rules
                  </Button>
                </Link>
              </>
            )}

            <div className="h-4 w-px bg-gray-300 mx-2" />
            
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              size="sm"
              className="transition-all duration-200 hover:scale-105 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="transition-all duration-200"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
              <Button 
                variant={isActive('/dashboard') ? 'default' : 'ghost'} 
                className="w-full justify-start gap-2"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            
            <Link to="/upcoming" onClick={() => setIsMobileMenuOpen(false)}>
              <Button 
                variant={isActive('/upcoming') ? 'default' : 'ghost'} 
                className="w-full justify-start gap-2"
              >
                <Calendar className="h-4 w-4" />
                Upcoming
              </Button>
            </Link>

            <Link to="/my-locker" onClick={() => setIsMobileMenuOpen(false)}>
              <Button 
                variant={isActive('/my-locker') ? 'default' : 'ghost'} 
                className="w-full justify-start gap-2"
              >
                <User className="h-4 w-4" />
                My Locker
              </Button>
            </Link>

            {currentUser.role === 'admin' && (
              <>
                <Link to="/pending-requests" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button 
                    variant={isActive('/pending-requests') ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Pending Requests
                  </Button>
                </Link>
                
                <Link to="/manage-amenities" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button 
                    variant={isActive('/manage-amenities') ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Amenities
                  </Button>
                </Link>

                <Link to="/amenity-rules" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button 
                    variant={isActive('/amenity-rules') ? 'default' : 'ghost'} 
                    className="w-full justify-start gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Amenity Rules
                  </Button>
                </Link>
              </>
            )}

            <div className="pt-2 border-t border-gray-200">
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                className="w-full justify-start gap-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
