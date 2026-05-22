import { Tabs } from 'expo-router';
import { LayoutDashboard, AlertCircle, Calendar, MessageSquare } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';

export default function CMLayout() {
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
        options={{ href: null }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
