import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Users, CalendarDays, Inbox, UserCircle } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';
import { Colors } from '@/constants/design';
import { supabase } from '@/lib/supabase';

function RequestsBadgeIcon({ color, size }: { color: ColorValue; size: number }) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('lesson_requests')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', user.id)
        .eq('status', 'pending');
      if (!cancelled) setPendingCount(count ?? 0);
    }

    load();

    const channel = supabase
      .channel('coach-pending-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_requests' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <View>
      <Inbox color={color} size={size} strokeWidth={1.5} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function CoachLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...(props as any)} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Students',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => <RequestsBadgeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen name="reviews" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.negative,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'JetBrainsMono-SemiBold',
    lineHeight: 12,
  },
});
