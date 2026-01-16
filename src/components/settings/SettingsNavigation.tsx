import React from 'react';
import { cn } from '@/lib/utils';
import { 
  User, 
  Shield, 
  Bell, 
  Users,
  Settings,
  Briefcase
} from 'lucide-react';

export type SettingsSection = 'account' | 'profile' | 'privacy' | 'notifications' | 'match-finder';

interface SettingsNavigationProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  isCoach: boolean;
}

const navigationItems = [
  { id: 'account' as const, label: 'Account', icon: Settings, description: 'Email, phone, password' },
  { id: 'profile' as const, label: 'Profile', icon: User, description: 'Personal & tennis info' },
  { id: 'privacy' as const, label: 'Privacy', icon: Shield, description: 'Location & visibility' },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell, description: 'Email & in-app alerts' },
  { id: 'match-finder' as const, label: 'Match Finder', icon: Users, description: 'Play preferences' },
];

const SettingsNavigation: React.FC<SettingsNavigationProps> = ({
  activeSection,
  onSectionChange,
  isCoach
}) => {
  const items = isCoach 
    ? [...navigationItems.slice(0, 2), 
       { id: 'profile' as const, label: 'Profile & Coaching', icon: Briefcase, description: 'Personal & business info' },
       ...navigationItems.slice(3)]
    : navigationItems;

  // Ensure profile item is correctly merged for coaches
  const displayItems = isCoach
    ? navigationItems.map(item => 
        item.id === 'profile' 
          ? { ...item, label: 'Profile & Coaching', icon: Briefcase, description: 'Personal & business info' }
          : item
      )
    : navigationItems;

  return (
    <>
      {/* Desktop Side Navigation */}
      <nav className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-4 space-y-1">
          {displayItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  isActive ? "bg-primary/10" : "bg-muted"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Top Tabs */}
      <div className="lg:hidden w-full overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {displayItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SettingsNavigation;
