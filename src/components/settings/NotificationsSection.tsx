import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, MessageSquare, Trophy, BookOpen, Megaphone } from 'lucide-react';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';

const NotificationsSection: React.FC = () => {
  const { preferences, loading, saving, updatePreference } = useInAppNotifications();

  const notificationItems = [
    { key: 'match_requests' as const, icon: Trophy, label: 'Match Requests', desc: 'Get notified when someone wants to play' },
    { key: 'new_messages' as const, icon: MessageSquare, label: 'New Messages', desc: 'Get notified when you receive new messages' },
    { key: 'lesson_updates' as const, icon: BookOpen, label: 'Lesson Updates', desc: 'Notifications about lesson bookings and changes' },
    { key: 'community_announcements' as const, icon: Megaphone, label: 'Community Announcements', desc: 'Updates from your HOA communities' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Notifications</CardTitle>
        </div>
        <CardDescription>Control which notifications you receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          notificationItems.map(({ key, icon: Icon, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <Label className="font-medium">{label}</Label>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch
                checked={preferences[key]}
                onCheckedChange={(checked) => updatePreference(key, checked)}
                disabled={saving}
                className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsSection;
