import { Tabs } from 'expo-router';
import { Home, CalendarDays, Wrench, Calendar, FileText } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';

export default function ResidentLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...(props as any)} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} strokeWidth={1.5} />,
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
        name="docs"
        options={{
          title: 'Docs',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
