import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';

const GlobalAppHeader: React.FC = () => {
  const location = useLocation();
  const isCM = location.pathname.startsWith('/cm');

  const bellTo = isCM ? '/cm/settings/notifications' : '/notifications';
  const menuTo = isCM ? '/cm/settings' : '/settings';

  return (
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
          style={{ height: 36, width: 'auto' }}
        />
      </Link>
      <div className="flex items-center gap-4">
        <Link
          to={bellTo}
          aria-label="Notifications"
          className="flex items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Bell className="h-5 w-5" style={{ color: '#FFFFFF' }} />
        </Link>
        <Link
          to={menuTo}
          aria-label="Menu"
          className="flex items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Menu className="h-6 w-6" style={{ color: '#FFFFFF' }} />
        </Link>
      </div>
    </header>
  );
};

export default GlobalAppHeader;
