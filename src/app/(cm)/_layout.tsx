import { Tabs, Redirect } from 'expo-router';
import { LayoutDashboard, AlertCircle, Calendar, Bell } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';
import { useSession } from '@/context/NativeAuthContext';

export default function CMLayout() {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...(props as any)} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Issues',
          tabBarIcon: ({ color, size }) => <AlertCircle color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{ href: null }}
      />
    </Tabs>
  );
}
