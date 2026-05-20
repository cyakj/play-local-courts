import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import CMNotificationCenter from '@/components/condo-manager/CMNotificationCenter';
import { useCondoManagerNotifications } from '@/hooks/useCondoManagerData';

const GlobalAppHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isCM = location.pathname.startsWith('/cm');
  const [showNotifs, setShowNotifs] = useState(false);

  const { unreadCount } = useCondoManagerNotifications();

  const handleBell = () => {
    if (isCM) setShowNotifs(true);
    else navigate('/notifications');
  };

  const handleMenu = () => {
    navigate(isCM ? '/cm/settings' : '/settings');
  };

  return (
    <>
      <header
        className="sticky top-0 left-0 right-0 z-40 flex items-center justify-between"
        style={{
          backgroundColor: '#0F1F3D',
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        <Link to={isCM ? '/cm' : '/dashboard'} className="flex items-center">
          <img
            src="/images/TenisX_logo-removebg-preview.png"
            alt="TenisX"
            style={{ height: 80, width: 'auto', maxWidth: 220, display: 'block' }}
          />
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBell}
            aria-label="Notifications"
            className="relative flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Bell className="h-5 w-5" style={{ color: '#FFFFFF' }} />
            {isCM && unreadCount > 0 && (
              <span
                className="absolute bg-red-500 text-white rounded-full flex items-center justify-center font-bold"
                style={{ top: 6, right: 6, width: 16, height: 16, fontSize: 10 }}
              >
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={handleMenu}
            aria-label="Menu"
            className="flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Menu className="h-6 w-6" style={{ color: '#FFFFFF' }} />
          </button>
        </div>
      </header>
      {showNotifs && isCM && (
        <CMNotificationCenter onClose={() => setShowNotifs(false)} />
      )}
    </>
  );
};

export default GlobalAppHeader;
