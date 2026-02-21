import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, MessageSquare, Trophy, BookOpen, Megaphone } from "lucide-react";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useMode } from "@/contexts/ModeContext";
import EmailPreferences from "@/components/EmailPreferences";

const NotificationsSection: React.FC = () => {
  const { preferences, loading, saving, updatePreference } = useInAppNotifications();
  const { isHOAMode } = useMode();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">In-App Notifications</CardTitle>
          </div>
          <CardDescription>Control which notifications appear within the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Tennis notifications hidden in HOA mode */}
              {!isHOAMode && (
                <>
                  <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-xl"><Trophy className="h-5 w-5 text-muted-foreground" /></div>
                      <div>
                        <Label className="font-medium">Match Requests</Label>
                        <p className="text-sm text-muted-foreground">Get notified when someone wants to play</p>
                      </div>
                    </div>
                    <Switch checked={preferences.match_requests}
                      onCheckedChange={(checked) => updatePreference("match_requests", checked)}
                      disabled={saving}
                      className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary" />
                  </div>

                  <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-xl"><BookOpen className="h-5 w-5 text-muted-foreground" /></div>
                      <div>
                        <Label className="font-medium">Lesson Updates</Label>
                        <p className="text-sm text-muted-foreground">Notifications about lesson bookings and changes</p>
                      </div>
                    </div>
                    <Switch checked={preferences.lesson_updates}
                      onCheckedChange={(checked) => updatePreference("lesson_updates", checked)}
                      disabled={saving}
                      className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary" />
                  </div>
                </>
              )}

              {/* HOA notifications always shown */}
              <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-xl"><Megaphone className="h-5 w-5 text-muted-foreground" /></div>
                  <div>
                    <Label className="font-medium">Community Announcements</Label>
                    <p className="text-sm text-muted-foreground">Updates from your HOA communities</p>
                  </div>
                </div>
                <Switch checked={preferences.community_announcements}
                  onCheckedChange={(checked) => updatePreference("community_announcements", checked)}
                  disabled={saving}
                  className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary" />
              </div>

              <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-xl"><MessageSquare className="h-5 w-5 text-muted-foreground" /></div>
                  <div>
                    <Label className="font-medium">New Messages</Label>
                    <p className="text-sm text-muted-foreground">Get notified when you receive new messages</p>
                  </div>
                </div>
                <Switch checked={preferences.new_messages}
                  onCheckedChange={(checked) => updatePreference("new_messages", checked)}
                  disabled={saving}
                  className="data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="[&>div]:border-0 [&>div]:shadow-lg [&>div]:rounded-2xl">
        <Card className="p-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-blue-500/5">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Email Notifications</CardTitle>
            </div>
            <CardDescription>Control which emails you receive from the platform</CardDescription>
          </CardHeader>
          <div className="-mt-4"><EmailPreferences /></div>
        </Card>
      </div>
    </div>
  );
};

export default NotificationsSection;
