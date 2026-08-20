import { Tabs, Redirect } from 'expo-router';
import { Text } from 'react-native';
import { Home, MapPin, GraduationCap, UserCircle, Building2, CalendarDays } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';
import { useSession } from '@/context/NativeAuthContext';
import { isCommunityMode } from '@/config/productMode';

export default function ResidentLayout() {
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
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="courts"
        options={{
          title: 'Reserve',
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="match"
        options={{
          title: 'Match',
          tabBarLabel: 'VS',
          href: isCommunityMode ? null : undefined,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 17, color, letterSpacing: -0.5, lineHeight: 22 }}>
              VS
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="coaches"
        options={{
          title: 'Coaches',
          href: isCommunityMode ? null : undefined,
          tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          href: isCommunityMode ? undefined : null,
          tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Schedule',
          href: isCommunityMode ? undefined : null,
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} strokeWidth={1.5} />,
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
      <Tabs.Screen name="docs"     options={{ href: null }} />
    </Tabs>
  );
}
