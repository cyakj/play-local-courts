import { Tabs } from 'expo-router';
import { Home, MapPin, Swords, GraduationCap, UserCircle } from 'lucide-react-native';
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
        name="courts"
        options={{
          title: 'Courts',
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="match"
        options={{
          title: 'Match',
          tabBarIcon: ({ color, size }) => <Swords color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="coaches"
        options={{
          title: 'Coaches',
          tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      {/* Legacy routes — routable but not tab items */}
      <Tabs.Screen name="book"     options={{ href: null }} />
      <Tabs.Screen name="report"   options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="docs"     options={{ href: null }} />
    </Tabs>
  );
}
