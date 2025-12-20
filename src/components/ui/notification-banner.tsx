import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NotificationBannerProps {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onDismiss?: (id: string) => void;
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({
  id,
  message,
  type = 'info',
  duration = 5000,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));
    
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.(id);
    }, 300);
  };

  const typeStyles = {
    info: 'bg-primary text-primary-foreground',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-black',
    error: 'bg-destructive text-destructive-foreground'
  };

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none',
        'transition-transform duration-300 ease-out',
        isVisible && !isExiting ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <div
        className={cn(
          'mt-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto',
          'min-w-[300px] max-w-[90vw]',
          typeStyles[type]
        )}
      >
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button
          onClick={handleDismiss}
          className="p-1 hover:opacity-70 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Notification container to manage multiple notifications
interface Notification {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

let notificationId = 0;
const listeners: Array<(notification: Notification) => void> = [];

export const showNotification = (
  message: string, 
  type: Notification['type'] = 'info',
  duration = 5000
) => {
  const notification: Notification = {
    id: `notification-${++notificationId}`,
    message,
    type,
    duration
  };
  listeners.forEach(listener => listener(notification));
  return notification.id;
};

export const NotificationContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const handler = (notification: Notification) => {
      setNotifications(prev => [...prev, notification]);
    };
    listeners.push(handler);
    return () => {
      const index = listeners.indexOf(handler);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{ transform: `translateY(${index * 60}px)` }}
        >
          <NotificationBanner
            {...notification}
            onDismiss={handleDismiss}
          />
        </div>
      ))}
    </>
  );
};

export default NotificationBanner;
