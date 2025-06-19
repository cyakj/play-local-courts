
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Home, Calendar, Users, Settings, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  useEffect(() => {
    if (currentUser) {
      checkForUnreadMessages();
    }
  }, [currentUser]);

  const checkForUnreadMessages = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', currentUser.id)
        .limit(1);

      if (error) throw error;
      setHasUnreadMessages((data?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking for unread messages:', error);
    }
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

  console.log('Current user role:', currentUser.role); // Debug log

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-primary">
              HOA Amenities
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link to="/dashboard">
              <Button 
                variant={isActive('/dashboard') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            
            <Link to="/upcoming">
              <Button 
                variant={isActive('/upcoming') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Upcoming
              </Button>
            </Link>

            {/* Show My Locker for all users except pure admins */}
            <Link to="/my-locker">
              <Button 
                variant={isActive('/my-locker') ? 'default' : 'ghost'} 
                size="sm"
                className="flex items-center gap-2 relative"
              >
                <User className="h-4 w-4" />
                My Locker
                {hasUnreadMessages && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                )}
              </Button>
            </Link>

            {currentUser.role === 'admin' && (
              <>
                <Link to="/pending-requests">
                  <Button 
                    variant={isActive('/pending-requests') ? 'default' : 'ghost'} 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Pending Requests
                  </Button>
                </Link>
                
                <Link to="/manage-amenities">
                  <Button 
                    variant={isActive('/manage-amenities') ? 'default' : 'ghost'} 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Amenities
                  </Button>
                </Link>
                
                <Link to="/amenity-rules">
                  <Button 
                    variant={isActive('/amenity-rules') ? 'default' : 'ghost'} 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Amenity Rules
                  </Button>
                </Link>
              </>
            )}
            
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
