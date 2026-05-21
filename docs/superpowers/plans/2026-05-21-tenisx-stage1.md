# TenisX Stage 1 Native Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild TenisX as a native Expo + React Native app with 7 Stage 1 screens (AdminHub, MaintenanceReports, ManageAmenities, ManageCourts, PendingRequests, Resident Booking, Resident Issue Reporting).

**Architecture:** File-based routing via Expo Router with route groups `(cm)`, `(admin)`, `(resident)`, and `(auth)`. All styling via React Native `StyleSheet.create` with typed design tokens — no NativeWind or CSS-in-JS. Supabase JS client for data, typed with the reference schema.

**Tech Stack:** Expo SDK 56, Expo Router, React Native StyleSheet, expo-font (Manrope + Inter), @supabase/supabase-js, lucide-react-native, react-native-svg, react-native-safe-area-context

---

## File Map

**New files to create:**
```
src/
  constants/
    design.ts                        ← all design tokens
  lib/
    supabase.ts                      ← typed Supabase client
    types.ts                         ← Database type from reference repo
  components/
    ui/
      Header.tsx                     ← 3 header variants
      Card.tsx                       ← base card + accent border
      StatusPill.tsx                 ← status badge
      StatsGrid.tsx                  ← 4-col stats row
      HealthBar.tsx                  ← progress bar
      Button.tsx                     ← 4 variants
      EmptyState.tsx                 ← empty list state
      Skeleton.tsx                   ← loading skeleton
      BottomNav.tsx                  ← glassmorphic tab bar
  app/
    _layout.tsx                      ← REPLACE: root layout (fonts, auth gate, light mode)
    (auth)/
      _layout.tsx                    ← stack layout
      login.tsx                      ← login screen
    (cm)/
      _layout.tsx                    ← CM tab bar layout
      index.tsx                      ← AdminHub screen
      maintenance.tsx                ← MaintenanceReports screen
    (admin)/
      _layout.tsx                    ← admin stack layout
      manage-amenities.tsx
      manage-courts.tsx
      pending-requests.tsx
    (resident)/
      _layout.tsx                    ← resident tab bar layout
      index.tsx                      ← resident home + booking
      report.tsx                     ← issue reporting
assets/
  fonts/
    Manrope-Regular.ttf
    Manrope-Bold.ttf
    Manrope-ExtraBold.ttf
    Manrope-Black.ttf
    Inter-Regular.ttf
    Inter-SemiBold.ttf
```

**Files to delete/replace:**
- `src/app/index.tsx` — replaced by `(cm)/index.tsx` and `(resident)/index.tsx`
- `src/app/explore.tsx` — removed
- `src/app/_layout.tsx` — replaced
- `src/components/app-tabs.tsx` — replaced by BottomNav.tsx
- `src/components/app-tabs.web.tsx` — removed
- `src/constants/theme.ts` — replaced by `src/constants/design.ts`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage lucide-react-native react-native-svg
```

Expected output: packages added to node_modules, package.json updated.

- [ ] **Step 2: Download Manrope font files into assets/fonts/**

```bash
mkdir -p assets/fonts
```

Then download from Google Fonts. Run each curl command:

```bash
curl -L "https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggqxSuXd.woff2" -o assets/fonts/Manrope-Regular.ttf
```

**Alternative (reliable):** Visit https://fonts.google.com/specimen/Manrope, download the family zip, extract these weights into `assets/fonts/`:
- `Manrope-Regular.ttf` (400)
- `Manrope-Bold.ttf` (700)
- `Manrope-ExtraBold.ttf` (800)
- `Manrope-Black.ttf` (900)

And https://fonts.google.com/specimen/Inter:
- `Inter-Regular.ttf` (400)
- `Inter-SemiBold.ttf` (600)

**Note:** For fastest results use the `expo-google-fonts` package instead:

```bash
npx expo install @expo-google-fonts/manrope @expo-google-fonts/inter
```

This downloads TTF files as JS modules. If using this approach, skip the curl steps and import like:
```ts
import { Manrope_900Black, Manrope_800ExtraBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or pre-existing errors only, none from new packages).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json assets/fonts/
git commit -m "chore: install supabase, lucide, svg deps; add Manrope + Inter font assets"
```

---

## Task 2: Design Tokens

**Files:**
- Create: `src/constants/design.ts`
- Delete: `src/constants/theme.ts` (after updating all imports)

- [ ] **Step 1: Create `src/constants/design.ts`**

```typescript
import { Platform, StyleSheet } from 'react-native';

export const Colors = {
  pageBg: '#F9FAFB',
  cardBg: '#FFFFFF',
  headerBg: '#0F1F3D',
  accentCyan: '#00D4FF',
  navy: '#0F1F3D',
  border: 'rgba(15,31,61,0.08)',
  coral: '#F97066',
  red: '#EF4444',
  textPrimary: '#0F1F3D',
  textMuted: '#8892A4',
  textSubtle: '#4B5563',
  textPlaceholder: '#9CA3AF',
  optimalBg: '#E0F9FF',
  attentionBg: '#FFF5F5',
  criticalBg: '#FEF2F2',
  blueMid: '#0369A1',
} as const;

export const FontFamily = {
  manropeBlack: 'Manrope-Black',
  manropeExtraBold: 'Manrope-ExtraBold',
  manropeBold: 'Manrope-Bold',
  interRegular: 'Inter-Regular',
  interSemiBold: 'Inter-SemiBold',
} as const;

export const FontSize = {
  pageTitle: 32,
  sectionTitle: 18,
  cardTitle: 16,
  keyMetric: 40,
  statValue: 24,
  body: 15,
  uiLabel: 13,
  metadata: 11,
  min: 12,
} as const;

export const Radius = {
  card: 16,
  button: 12,
  pill: 99,
  input: 8,
  modal: 20,
} as const;

export const Spacing = {
  pagePx: 20,
  cardGap: 12,
  sectionGap: 16,
  cardPadding: 20,
  headerPt: 48,
  tapTarget: 44,
} as const;

export const MaxWidth = 480;

export const Shadow = StyleSheet.create({
  card: {
    shadowColor: '#0F1F3D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
}).card;

export const CyanGlow = StyleSheet.create({
  glow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
}).glow;

export function getHealthColor(score: number): string {
  if (score >= 70) return Colors.accentCyan;
  if (score >= 40) return Colors.coral;
  return Colors.red;
}

export function getHealthAccent(score: number): 'optimal' | 'attention' | 'critical' {
  if (score >= 70) return 'optimal';
  if (score >= 40) return 'attention';
  return 'critical';
}
```

- [ ] **Step 2: Update any existing imports from `@/constants/theme` to `@/constants/design`**

Search for all files importing from theme:
```bash
grep -r "constants/theme" src/ --include="*.tsx" --include="*.ts" -l
```

For each file found, replace `import { ... } from '@/constants/theme'` with equivalent imports from `@/constants/design`. The old `Spacing` token names (`.two`, `.three`, `.four`) are replaced by the new semantic names; update call sites accordingly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors from new file.

- [ ] **Step 4: Commit**

```bash
git add src/constants/design.ts
git commit -m "feat: add TenisX design tokens (colors, typography, spacing, radii, shadows)"
```

---

## Task 3: Supabase Client + Database Types

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create `src/lib/types.ts`**

Fetch the full type file from the reference repo and save it:

```bash
curl -s "https://raw.githubusercontent.com/cyakj/play-local-courts/main/src/integrations/supabase/types.ts" -o src/lib/types.ts
```

If curl fails, manually copy the content from https://raw.githubusercontent.com/cyakj/play-local-courts/main/src/integrations/supabase/types.ts

- [ ] **Step 2: Create `src/lib/supabase.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: Create `.env` with Supabase credentials**

Create `C:\Users\info\tenisx-native\.env` (not committed):

```
EXPO_PUBLIC_SUPABASE_URL=<copy from the reference repo .env or Supabase dashboard>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<copy from the reference repo .env or Supabase dashboard>
```

**Where to find these:** In the reference web repo at https://github.com/cyakj/play-local-courts look for `.env` or `src/integrations/supabase/client.ts`. Alternatively, log into supabase.com, open the project, go to Settings → API.

- [ ] **Step 4: Add .env to .gitignore**

Open `.gitignore` and verify `.env` is listed. If not, add it.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/types.ts .gitignore
git commit -m "feat: add typed Supabase client + database type definitions"
```

---

## Task 4: Root Layout — Font Loading + Light Mode + Auth Gate

**Files:**
- Modify: `src/app/_layout.tsx` (full replacement)

- [ ] **Step 1: Replace `src/app/_layout.tsx`**

```typescript
import { useFonts } from 'expo-font';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();
setBackgroundColorAsync('#F9FAFB');

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Black': require('../../assets/fonts/Manrope-Black.ttf'),
    'Manrope-ExtraBold': require('../../assets/fonts/Manrope-ExtraBold.ttf'),
    'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
    'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  if ((!fontsLoaded && !fontError) || authLoading) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F9FAFB' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(cm)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(resident)" />
    </Stack>
  );
}
```

**Note on `@expo-google-fonts` alternative:** If you used `@expo-google-fonts/manrope` and `@expo-google-fonts/inter` in Task 1, replace the `useFonts` call with:
```typescript
import { Manrope_900Black, Manrope_800ExtraBold, Manrope_700Bold, Manrope_400Regular } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';

const [fontsLoaded, fontError] = useFonts({
  'Manrope-Black': Manrope_900Black,
  'Manrope-ExtraBold': Manrope_800ExtraBold,
  'Manrope-Bold': Manrope_700Bold,
  'Manrope-Regular': Manrope_400Regular,
  'Inter-Regular': Inter_400Regular,
  'Inter-SemiBold': Inter_600SemiBold,
});
```

- [ ] **Step 2: Create `src/app/(auth)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create `src/app/(auth)/login.tsx`** (stub — full implementation optional for Stage 1)

```typescript
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
    } else {
      router.replace('/(cm)');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>TenisX</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={Colors.textPlaceholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.textPlaceholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg, paddingHorizontal: Spacing.pagePx, justifyContent: 'center', gap: 12 },
  title: { fontFamily: FontFamily.manropeBlack, fontSize: 32, color: Colors.navy, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input, padding: 14, fontSize: 14, fontFamily: FontFamily.interRegular, color: Colors.textPrimary, backgroundColor: Colors.cardBg, minHeight: Spacing.tapTarget },
  button: { backgroundColor: Colors.navy, borderRadius: Radius.button, padding: 14, alignItems: 'center', minHeight: Spacing.tapTarget },
  buttonText: { fontFamily: FontFamily.interSemiBold, fontSize: 14, color: '#FFF' },
});
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/_layout.tsx src/app/(auth)/
git commit -m "feat: root layout with font loading, auth gate, and light mode enforcement"
```

---

## Task 5: Shared UI — Header Component

**Files:**
- Create: `src/components/ui/Header.tsx`

The Header component has three variants, all on a navy (`#0F1F3D`) background with iOS safe-area top padding.

- [ ] **Step 1: Create `src/components/ui/Header.tsx`**

```typescript
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ArrowLeft, Menu } from 'lucide-react-native';

import { Colors, FontFamily, FontSize } from '@/constants/design';

interface CMPortfolioHeaderProps {
  variant: 'cm-portfolio';
  greeting: string;
  subCopy: string;
  onBell?: () => void;
  onMenu?: () => void;
}

interface ResidentHomeHeaderProps {
  variant: 'resident-home';
  greeting: string;
  subCopy: string;
  avatarInitials?: string;
  onBell?: () => void;
}

interface InnerScreenHeaderProps {
  variant: 'inner';
  title: string;
  onBack?: () => void;
  rightIcon?: React.ReactNode;
}

type HeaderProps = CMPortfolioHeaderProps | ResidentHomeHeaderProps | InnerScreenHeaderProps;

export function Header(props: HeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 24);

  if (props.variant === 'inner') {
    return (
      <View style={[styles.base, { paddingTop: topPad + 8, paddingBottom: 20 }]}>
        <View style={styles.innerRow}>
          <TouchableOpacity onPress={props.onBack} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft color="#FFFFFF" size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={styles.innerTitle} numberOfLines={1}>{props.title}</Text>
          <View style={styles.iconBtn}>{props.rightIcon ?? null}</View>
        </View>
      </View>
    );
  }

  const isCM = props.variant === 'cm-portfolio';

  return (
    <View style={[styles.base, styles.portfolioBase, { paddingTop: topPad + 12 }]}>
      <View style={styles.topBar}>
        {isCM ? (
          <Text style={styles.logo}>TenisX</Text>
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(props as ResidentHomeHeaderProps).avatarInitials ?? 'U'}</Text>
          </View>
        )}
        <View style={styles.topBarRight}>
          <TouchableOpacity onPress={props.onBell} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          {isCM && (
            <TouchableOpacity onPress={(props as CMPortfolioHeaderProps).onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Menu color="#FFFFFF" size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.welcomeTag}>WELCOME BACK</Text>
      <Text style={styles.greeting}>{props.greeting}</Text>
      <Text style={styles.subCopy}>{props.subCopy}</Text>
      <View style={styles.bottomFade} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 20,
    paddingBottom: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  portfolioBase: {
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  logo: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 22,
    color: '#FFFFFF',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 16,
    color: Colors.navy,
  },
  welcomeTag: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.accentCyan,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  greeting: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: FontSize.pageTitle,
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 8,
  },
  subCopy: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: 'rgba(0,212,255,0.7)',
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 18,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Header.tsx
git commit -m "feat: add Header component (cm-portfolio, resident-home, inner variants)"
```

---

## Task 6: Shared UI — Card, StatusPill, StatsGrid, HealthBar

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/StatusPill.tsx`
- Create: `src/components/ui/StatsGrid.tsx`
- Create: `src/components/ui/HealthBar.tsx`

- [ ] **Step 1: Create `src/components/ui/Card.tsx`**

```typescript
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/design';

type AccentVariant = 'optimal' | 'attention' | 'critical' | 'none';

const accentColors: Record<AccentVariant, string> = {
  optimal: Colors.accentCyan,
  attention: Colors.coral,
  critical: Colors.red,
  none: 'transparent',
};

interface CardProps {
  children: React.ReactNode;
  accent?: AccentVariant;
  onPress?: () => void;
  style?: object;
}

export function Card({ children, accent = 'none', onPress, style }: CardProps) {
  const borderLeftColor = accentColors[accent];
  const accentStyle = accent !== 'none' ? { borderLeftWidth: 2, borderLeftColor } : {};

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, accentStyle, style]}
        onPress={onPress}
        activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, accentStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
});
```

- [ ] **Step 2: Create `src/components/ui/StatusPill.tsx`**

```typescript
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/design';

type StatusVariant = 'optimal' | 'needs-attention' | 'critical' | 'pending' | 'approved' | 'rejected' | 'open' | 'in-progress' | 'resolved';

const pillConfig: Record<StatusVariant, { bg: string; text: string; border: string; label: string }> = {
  optimal:        { bg: Colors.optimalBg,    text: Colors.blueMid,   border: Colors.accentCyan, label: 'Optimal' },
  'needs-attention': { bg: Colors.attentionBg, text: '#C0392B',     border: Colors.coral,      label: 'Needs Attention' },
  critical:       { bg: Colors.criticalBg,   text: '#991B1B',        border: Colors.red,        label: 'Critical' },
  pending:        { bg: '#FFF9E6',            text: '#92400E',        border: '#F59E0B',         label: 'Pending' },
  approved:       { bg: Colors.optimalBg,    text: Colors.blueMid,   border: Colors.accentCyan, label: 'Approved' },
  rejected:       { bg: Colors.criticalBg,   text: '#991B1B',        border: Colors.red,        label: 'Rejected' },
  open:           { bg: '#EFF6FF',            text: '#1D4ED8',        border: '#3B82F6',         label: 'Open' },
  'in-progress':  { bg: '#FFF9E6',            text: '#92400E',        border: '#F59E0B',         label: 'In Progress' },
  resolved:       { bg: Colors.optimalBg,    text: Colors.blueMid,   border: Colors.accentCyan, label: 'Resolved' },
};

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const config = pillConfig[status];
  return (
    <View style={[styles.pill, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[styles.text, { color: config.text }]}>{label ?? config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    fontWeight: '700',
  },
});
```

- [ ] **Step 3: Create `src/components/ui/StatsGrid.tsx`**

```typescript
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/design';

interface StatItem {
  value: string | number;
  label: string;
}

interface StatsGridProps {
  stats: [StatItem, StatItem, StatItem, StatItem];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <View style={styles.grid}>
      {stats.map((stat, i) => (
        <View key={i} style={styles.col}>
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 20,
    color: Colors.navy,
  },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textSubtle,
    letterSpacing: 1.0,
  },
});
```

- [ ] **Step 4: Create `src/components/ui/HealthBar.tsx`**

```typescript
import { StyleSheet, View } from 'react-native';
import { getHealthColor } from '@/constants/design';

interface HealthBarProps {
  score: number;
  height?: number;
}

export function HealthBar({ score, height = 4 }: HealthBarProps) {
  const fillColor = getHealthColor(score);
  const width = `${Math.min(Math.max(score, 0), 100)}%` as const;

  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width, backgroundColor: fillColor, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#F3F4F6',
    borderRadius: 99,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 99,
  },
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/StatusPill.tsx src/components/ui/StatsGrid.tsx src/components/ui/HealthBar.tsx
git commit -m "feat: add Card, StatusPill, StatsGrid, HealthBar shared components"
```

---

## Task 7: Shared UI — Button, EmptyState, Skeleton, BottomNav

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/BottomNav.tsx`

- [ ] **Step 1: Create `src/components/ui/Button.tsx`**

```typescript
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/design';

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; borderColor?: string }> = {
  primary:     { bg: Colors.navy,        text: '#FFFFFF' },
  accent:      { bg: Colors.accentCyan,  text: Colors.navy },
  ghost:       { bg: '#F3F4F6',          text: '#6B7280', borderColor: '#E5E7EB' },
  destructive: { bg: 'transparent',      text: Colors.red, borderColor: Colors.red },
};

export function Button({ variant = 'primary', label, onPress, loading = false, disabled = false, fullWidth = false }: ButtonProps) {
  const v = variantStyles[variant];
  return (
    <TouchableOpacity
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.borderColor ?? 'transparent', borderWidth: v.borderColor ? 1 : 0 },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      {loading
        ? <ActivityIndicator color={v.text} size="small" />
        : <Text style={[styles.label, { color: v.text }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.tapTarget,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Create `src/components/ui/EmptyState.tsx`**

```typescript
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/design';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {ctaLabel && onCta && (
        <Button variant="primary" label={ctaLabel} onPress={onCta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  iconWrap: { marginBottom: 4 },
  title: { fontFamily: FontFamily.manropeBold, fontSize: 18, color: Colors.navy, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
```

- [ ] **Step 3: Create `src/components/ui/Skeleton.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Radius } from '@/constants/design';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.card, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as number, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={16} borderRadius={8} />
      <Skeleton width="100%" height={12} borderRadius={6} style={{ marginTop: 10 }} />
      <Skeleton width="100%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
      <Skeleton width="40%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#E5E7EB' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,31,61,0.08)',
  },
});
```

- [ ] **Step 4: Create `src/components/ui/BottomNav.tsx`**

This is a custom bottom tab bar for use with Expo Router Tabs. It applies the glassmorphic design from DESIGN.md.

```typescript
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, FontFamily } from '@/constants/design';

export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel as string ?? options.title ?? route.name;
        const isFocused = state.index === index;
        const icon = options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? Colors.accentCyan : Colors.textMuted,
          size: 22,
        });

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => {
              if (!isFocused) navigation.navigate(route.name);
            }}
            activeOpacity={0.7}>
            {icon}
            <Text style={[styles.label, { color: isFocused ? Colors.accentCyan : Colors.textMuted }]}>
              {String(label).toUpperCase()}
            </Text>
            {isFocused && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,31,61,0.08)',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentCyan,
    marginTop: 2,
  },
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/EmptyState.tsx src/components/ui/Skeleton.tsx src/components/ui/BottomNav.tsx
git commit -m "feat: add Button, EmptyState, Skeleton, BottomNav shared components"
```

---

## Task 8: CM Navigation Layout

**Files:**
- Create: `src/app/(cm)/_layout.tsx`

- [ ] **Step 1: Create `src/app/(cm)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router';
import { LayoutDashboard, AlertCircle, Calendar, Bell } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';

export default function CMLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
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
    </Tabs>
  );
}
```

- [ ] **Step 2: Create stubs for calendar and alerts tabs**

Create `src/app/(cm)/calendar.tsx`:
```typescript
import { Text, View } from 'react-native';
import { Colors } from '@/constants/design';
export default function CalendarScreen() {
  return <View style={{ flex: 1, backgroundColor: Colors.pageBg }} />;
}
```

Create `src/app/(cm)/alerts.tsx`:
```typescript
import { View } from 'react-native';
import { Colors } from '@/constants/design';
export default function AlertsScreen() {
  return <View style={{ flex: 1, backgroundColor: Colors.pageBg }} />;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(cm)/
git commit -m "feat: CM tab navigator layout with Portfolio/Issues/Calendar/Alerts tabs"
```

---

## Task 9: Screen 1 — AdminHub (CMPortfolio)

**Files:**
- Create: `src/app/(cm)/index.tsx`

**Data:** Queries `hoas` joined to `hoa_memberships` for community stats. Computes a health score per community. Displays portfolio-level aggregate stats.

- [ ] **Step 1: Create `src/app/(cm)/index.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Building2, Users, BookOpen, AlertCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Spacing, getHealthColor, getHealthAccent, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { HealthBar } from '@/components/ui/HealthBar';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Hoa = Database['public']['Tables']['hoas']['Row'];

interface CommunityWithStats extends Hoa {
  memberCount: number;
  openIssues: number;
  activeBookings: number;
  healthScore: number;
}

export default function AdminHubScreen() {
  const [communities, setCommunities] = useState<CommunityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      if (profile) setUserName(`${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim());
    }

    const { data: hoas } = await supabase.from('hoas').select('*');
    if (!hoas) { setLoading(false); return; }

    const enriched: CommunityWithStats[] = await Promise.all(
      hoas.map(async (hoa) => {
        const [membersRes, issuesRes, bookingsRes] = await Promise.all([
          supabase.from('hoa_memberships').select('id', { count: 'exact' }).eq('hoa_id', hoa.id),
          supabase.from('maintenance_reports').select('id', { count: 'exact' }).eq('hoa_id', hoa.id).eq('status', 'open'),
          supabase.from('bookings').select('id', { count: 'exact' }).eq('hoa_id', hoa.id),
        ]);
        const memberCount = membersRes.count ?? 0;
        const openIssues = issuesRes.count ?? 0;
        const activeBookings = bookingsRes.count ?? 0;
        const healthScore = Math.max(0, Math.min(100, 100 - openIssues * 5));
        return { ...hoa, memberCount, openIssues, activeBookings, healthScore };
      })
    );

    setCommunities(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const totalCommunities = communities.length;
  const totalOpenIssues = communities.reduce((s, c) => s + c.openIssues, 0);
  const totalBookings = communities.reduce((s, c) => s + c.activeBookings, 0);
  const totalMembers = communities.reduce((s, c) => s + c.memberCount, 0);
  const avgHealth = communities.length
    ? Math.round(communities.reduce((s, c) => s + c.healthScore, 0) / communities.length)
    : 0;

  return (
    <View style={styles.screen}>
      <Header
        variant="cm-portfolio"
        greeting={`Hey${userName ? ', ' + userName.split(' ')[0] : ''}!`}
        subCopy={`${totalCommunities} communit${totalCommunities !== 1 ? 'ies' : 'y'} under management`}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Portfolio health score */}
          <Card style={styles.healthCard}>
            <Text style={styles.healthLabel}>PORTFOLIO HEALTH</Text>
            <Text style={[styles.healthScore, { color: getHealthColor(avgHealth) }]}>{avgHealth}</Text>
            <HealthBar score={avgHealth} height={6} />
          </Card>

          {/* Portfolio stats */}
          <StatsGrid stats={[
            { value: totalCommunities, label: 'Communities' },
            { value: totalOpenIssues, label: 'Issues' },
            { value: totalBookings, label: 'Bookings' },
            { value: totalMembers, label: 'Members' },
          ]} />

          {/* Community list */}
          <Text style={styles.sectionTitle}>Your Communities</Text>

          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && communities.length === 0 && (
            <EmptyState
              icon={<Building2 color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No communities yet"
              subtitle="Communities you manage will appear here."
            />
          )}

          {!loading && communities.map((c) => (
            <Card key={c.id} accent={getHealthAccent(c.healthScore)} style={styles.communityCard}>
              <View style={styles.communityHeader}>
                <Text style={styles.communityName} numberOfLines={1}>{c.name}</Text>
                <StatusPill status={c.healthScore >= 70 ? 'optimal' : c.healthScore >= 40 ? 'needs-attention' : 'critical'} />
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthRowLabel}>HEALTH SCORE</Text>
                <Text style={[styles.healthRowValue, { color: getHealthColor(c.healthScore) }]}>{c.healthScore}</Text>
              </View>
              <HealthBar score={c.healthScore} />

              <View style={styles.divider} />
              <StatsGrid stats={[
                { value: c.memberCount, label: 'Members' },
                { value: 0, label: 'Amenities' },
                { value: c.activeBookings, label: 'Bookings' },
                { value: c.openIssues, label: 'Issues' },
              ]} />

              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.manageRow}
                onPress={() => router.push({ pathname: '/(admin)/manage-amenities', params: { hoaId: c.id } })}>
                <Text style={styles.manageLink}>Manage →</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  healthCard: { alignItems: 'center', gap: 8, marginBottom: 4 },
  healthLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2 },
  healthScore: { fontFamily: FontFamily.manropeBlack, fontSize: FontSize.keyMetric },
  sectionTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, marginTop: Spacing.sectionGap, marginBottom: 4 },
  communityCard: { gap: 12, marginBottom: 0 },
  communityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communityName: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.cardTitle, color: Colors.navy, flex: 1, marginRight: 8 },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthRowLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2 },
  healthRowValue: { fontFamily: FontFamily.manropeBold, fontSize: 20 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  manageRow: { alignItems: 'flex-end' },
  manageLink: { fontFamily: FontFamily.manropeExtraBold, fontSize: 14, color: Colors.accentCyan, fontWeight: '800' },
});
```

- [ ] **Step 2: Run the app and verify the screen renders**

```bash
npm run web
```

Open http://localhost:8081 in a browser. Expect: navy header with "TenisX" logo and greeting, portfolio health card, stats grid, and community list (or empty state if no data).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(cm)/index.tsx
git commit -m "feat: AdminHub screen — portfolio dashboard with community health scores and stats"
```

---

## Task 10: Screen 2 — MaintenanceReports

**Files:**
- Create: `src/app/(cm)/maintenance.tsx`

**Data:** `maintenance_reports` table with filters by status/category. Real-time subscription.

- [ ] **Step 1: Create `src/app/(cm)/maintenance.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardList, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/lib/types';

type Report = Database['public']['Tables']['maintenance_reports']['Row'];
type ReportStatus = 'open' | 'in-progress' | 'resolved';

const STATUS_FILTERS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

export default function MaintenanceReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [selected, setSelected] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    let query = supabase.from('maintenance_reports').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setReports(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  useEffect(() => {
    const subscription = supabase
      .channel('maintenance_reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_reports' }, load)
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  async function updateStatus(id: string, status: string) {
    setSaving(true);
    await supabase.from('maintenance_reports').update({ status, admin_notes: adminNote || undefined }).eq('id', id);
    setSaving(false);
    setSelected(null);
    load();
  }

  const openCount = reports.filter((r) => r.status === 'open').length;
  const inProgressCount = reports.filter((r) => r.status === 'in-progress').length;

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Maintenance Reports" onBack={() => router.back()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Counts */}
          <View style={styles.countRow}>
            <View style={[styles.countBadge, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.countNum, { color: '#1D4ED8' }]}>{openCount}</Text>
              <Text style={styles.countLabel}>OPEN</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: '#FFF9E6' }]}>
              <Text style={[styles.countNum, { color: '#92400E' }]}>{inProgressCount}</Text>
              <Text style={styles.countLabel}>IN PROGRESS</Text>
            </View>
          </View>

          {/* Status filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterPill, statusFilter === f.value && styles.filterPillActive]}
                onPress={() => setStatusFilter(f.value)}>
                <Text style={[styles.filterLabel, statusFilter === f.value && styles.filterLabelActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && reports.length === 0 && (
            <EmptyState
              icon={<ClipboardList color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No reports found"
              subtitle={statusFilter === 'all' ? 'No maintenance reports have been submitted.' : `No ${statusFilter} reports.`}
            />
          )}

          {!loading && reports.map((r) => (
            <Card key={r.id} accent={r.status === 'open' ? 'critical' : r.status === 'in-progress' ? 'attention' : 'optimal'} onPress={() => setSelected(r)} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle} numberOfLines={1}>{r.title}</Text>
                <StatusPill status={(r.status as ReportStatus) ?? 'open'} />
              </View>
              {r.category && <Text style={styles.reportMeta}>{String(r.category).toUpperCase()}</Text>}
              <Text style={styles.reportDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selected.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ gap: 12, padding: Spacing.pagePx }}>
              <StatusPill status={(selected.status as ReportStatus) ?? 'open'} />
              {selected.description && <Text style={styles.modalDesc}>{selected.description}</Text>}
              <Text style={styles.modalLabel}>ADMIN NOTES</Text>
              <TextInput
                style={styles.noteInput}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Add notes…"
                placeholderTextColor={Colors.textPlaceholder}
                multiline
                numberOfLines={3}
              />
              <View style={styles.actionRow}>
                <Button variant="accent" label="Mark Resolved" onPress={() => updateStatus(selected.id, 'resolved')} loading={saving} />
                <Button variant="ghost" label="In Progress" onPress={() => updateStatus(selected.id, 'in-progress')} loading={saving} />
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  countRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  countBadge: { flex: 1, borderRadius: Radius.card, padding: 16, alignItems: 'center', gap: 4 },
  countNum: { fontFamily: FontFamily.manropeBlack, fontSize: 28 },
  countLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textSubtle, letterSpacing: 1 },
  filterScroll: { marginBottom: 4 },
  filterContent: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterPill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: Colors.cardBg },
  filterPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  filterLabelActive: { color: '#FFFFFF' },
  reportCard: { gap: 8 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  reportTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 15, color: Colors.navy, flex: 1 },
  reportMeta: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1 },
  reportDate: { fontFamily: FontFamily.interRegular, fontSize: FontSize.min, color: Colors.textMuted },
  modal: { flex: 1, backgroundColor: Colors.cardBg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, flex: 1, marginRight: 12 },
  modalScroll: { flex: 1 },
  modalDesc: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textPrimary, lineHeight: 22 },
  modalLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginTop: 8 },
  noteInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input, padding: 14, fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textPrimary, minHeight: 80 },
  actionRow: { flexDirection: 'row', gap: 12 },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(cm)/maintenance.tsx
git commit -m "feat: MaintenanceReports screen with filter pills, report cards, and status-update modal"
```

---

## Task 11: Admin Navigation + Screens 3–5

**Files:**
- Create: `src/app/(admin)/_layout.tsx`
- Create: `src/app/(admin)/manage-amenities.tsx`
- Create: `src/app/(admin)/manage-courts.tsx`
- Create: `src/app/(admin)/pending-requests.tsx`

- [ ] **Step 1: Create `src/app/(admin)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F9FAFB' } }} />;
}
```

- [ ] **Step 2: Create `src/app/(admin)/manage-amenities.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Trash2, Dumbbell, Waves, Building2, Flame, Utensils } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];

const AMENITY_TYPES = ['tennis', 'pickleball', 'pool', 'gym', 'clubhouse', 'barbecue', 'jacuzzi'] as const;
type AmenityType = typeof AMENITY_TYPES[number];

const typeIcons: Record<AmenityType, React.ReactNode> = {
  tennis:     <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
  pickleball: <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
  pool:       <Waves    color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
  gym:        <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
  clubhouse:  <Building2 color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
  barbecue:   <Flame    color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
  jacuzzi:    <Waves    color={Colors.accentCyan} size={20} strokeWidth={1.5} />,
};

export default function ManageAmenitiesScreen() {
  const [amenities, setAmenities] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AmenityType>('tennis');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('courts').select('*').order('name');
    setAmenities(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addAmenity() {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from('courts').insert({ name: newName.trim(), court_type: newType });
    setSaving(false);
    setShowAdd(false);
    setNewName('');
    load();
  }

  async function deleteAmenity(id: string, name: string) {
    Alert.alert('Delete Amenity', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('courts').delete().eq('id', id);
          load();
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Manage Amenities" onBack={() => router.back()} rightIcon={
        <TouchableOpacity onPress={() => setShowAdd(true)}>
          <Plus color="#FFFFFF" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
      } />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {!loading && amenities.length === 0 && (
            <EmptyState
              icon={<Building2 color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No amenities"
              subtitle="Add amenities to this community."
              ctaLabel="Add Amenity"
              onCta={() => setShowAdd(true)}
            />
          )}

          {amenities.map((a) => (
            <Card key={a.id} style={styles.amenityCard}>
              <View style={styles.amenityRow}>
                {typeIcons[(a.court_type as AmenityType) ?? 'tennis']}
                <View style={styles.amenityInfo}>
                  <Text style={styles.amenityName}>{a.name}</Text>
                  <Text style={styles.amenityType}>{String(a.court_type ?? '').toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteAmenity(a.id, a.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 color={Colors.red} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Add amenity modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAdd(false)}>
        <SafeAreaView style={styles.modal}>
          <Text style={styles.modalTitle}>Add Amenity</Text>
          <Text style={styles.inputLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Court A"
            placeholderTextColor={Colors.textPlaceholder}
          />
          <Text style={styles.inputLabel}>Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {AMENITY_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typePill, newType === t && styles.typePillActive]}
                onPress={() => setNewType(t)}>
                <Text style={[styles.typePillLabel, newType === t && styles.typePillLabelActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button variant="ghost" label="Cancel" onPress={() => setShowAdd(false)} />
            <Button variant="primary" label="Add" onPress={addAmenity} loading={saving} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  amenityCard: { padding: 16 },
  amenityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amenityInfo: { flex: 1 },
  amenityName: { fontFamily: FontFamily.manropeExtraBold, fontSize: 15, color: Colors.navy },
  amenityType: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1 },
  modal: { flex: 1, padding: Spacing.pagePx, backgroundColor: Colors.cardBg, gap: 8 },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, marginBottom: 12 },
  inputLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.navy, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input, padding: 14, fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textPrimary, minHeight: Spacing.tapTarget, marginBottom: 12 },
  typePill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.cardBg },
  typePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typePillLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  typePillLabelActive: { color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
```

- [ ] **Step 3: Create `src/app/(admin)/manage-courts.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { format, addDays, startOfDay } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

type SlotStatus = 'available' | 'booked' | 'maintenance';

function slotColor(s: SlotStatus): string {
  return s === 'available' ? Colors.optimalBg : s === 'booked' ? Colors.attentionBg : Colors.criticalBg;
}
function slotTextColor(s: SlotStatus): string {
  return s === 'available' ? Colors.blueMid : s === 'booked' ? '#92400E' : '#991B1B';
}

export default function ManageCourtsScreen() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));

  async function loadCourts() {
    const { data } = await supabase.from('courts').select('*').order('name');
    setCourts(data ?? []);
    if (data && data.length > 0) setSelectedCourt(data[0]);
    setLoading(false);
  }

  async function loadSlots() {
    if (!selectedCourt) return;
    const dayStart = selectedDate.toISOString();
    const dayEnd = addDays(selectedDate, 1).toISOString();
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('court_id', selectedCourt.id)
      .gte('start_time', dayStart)
      .lt('start_time', dayEnd);
    setBookings(data ?? []);
  }

  useEffect(() => { loadCourts(); }, []);
  useEffect(() => { loadSlots(); }, [selectedCourt, selectedDate]);

  function getSlotStatus(hour: number): SlotStatus {
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, 0, 0, 0);
    const booking = bookings.find((b) => {
      const start = new Date(b.start_time);
      return start.getHours() === hour;
    });
    if (!booking) return 'available';
    return (booking.status as SlotStatus) ?? 'booked';
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Manage Courts" onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Court selector */}
          <Text style={styles.sectionLabel}>AMENITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillContent}>
            {courts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pill, selectedCourt?.id === c.id && styles.pillActive]}
                onPress={() => setSelectedCourt(c)}>
                <Text style={[styles.pillLabel, selectedCourt?.id === c.id && styles.pillLabelActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date selector */}
          <Text style={styles.sectionLabel}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll} contentContainerStyle={styles.dateContent}>
            {dates.map((d) => {
              const isSelected = d.toDateString() === selectedDate.toDateString();
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[styles.dateBtn, isSelected && styles.dateBtnActive]}
                  onPress={() => setSelectedDate(d)}>
                  <Text style={[styles.dateDow, isSelected && styles.dateTextActive]}>{format(d, 'EEE')}</Text>
                  <Text style={[styles.dateNum, isSelected && styles.dateTextActive]}>{format(d, 'd')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time slots */}
          <Text style={styles.sectionLabel}>TIME SLOTS</Text>
          <View style={styles.slotsGrid}>
            {HOURS.map((h) => {
              const status = getSlotStatus(h);
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.slot, { backgroundColor: slotColor(status) }]}
                  onPress={() => { /* toggle maintenance */ }}>
                  <Text style={[styles.slotTime, { color: slotTextColor(status) }]}>
                    {h > 12 ? `${h - 12}pm` : `${h}am`}
                  </Text>
                  <Text style={[styles.slotStatus, { color: slotTextColor(status) }]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.sectionGap, paddingBottom: 100 },
  sectionLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  pillScroll: { marginBottom: 0 },
  pillContent: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  pill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.cardBg },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  pillLabelActive: { color: '#FFFFFF' },
  dateScroll: { marginBottom: 0 },
  dateContent: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  dateBtn: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', backgroundColor: Colors.cardBg, minWidth: 52 },
  dateBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dateDow: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted },
  dateNum: { fontFamily: FontFamily.manropeBold, fontSize: 18, color: Colors.navy },
  dateTextActive: { color: '#FFFFFF' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { borderRadius: Radius.button, padding: 12, alignItems: 'center', minWidth: '22%', flex: 1 },
  slotTime: { fontFamily: FontFamily.manropeBold, fontSize: 14 },
  slotStatus: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.min, marginTop: 2 },
});
```

**Note:** `date-fns` is not in `package.json`. Install it: `npx expo install date-fns`. If you prefer not to add it, replace `format`, `addDays`, `startOfDay` with vanilla JS:
```typescript
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// addDays: new Date(date.getTime() + days * 86400000)
// format: use date.getDate(), DAYS[date.getDay()], etc.
```

- [ ] **Step 4: Create `src/app/(admin)/pending-requests.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { UserCheck } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Spacing, MaxWidth } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import type { Database } from '@/lib/types';

type JoinRequest = Database['public']['Tables']['community_join_requests']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface RequestWithProfile extends JoinRequest {
  profile?: Profile;
}

export default function PendingRequestsScreen() {
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('community_join_requests')
      .select('*, profiles(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const sub = supabase
      .channel('community_join_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_join_requests' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function updateRequest(id: string, status: 'approved' | 'rejected') {
    setProcessing(id);
    await supabase.from('community_join_requests').update({ status }).eq('id', id);
    setProcessing(null);
    load();
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title={`Pending Requests${requests.length > 0 ? ` (${requests.length})` : ''}`}
        onBack={() => router.back()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && requests.length === 0 && (
            <EmptyState
              icon={<UserCheck color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No pending requests"
              subtitle="All membership requests have been reviewed."
            />
          )}

          {!loading && requests.map((r) => {
            const p = (r as any).profiles as Profile | undefined;
            const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : 'Unknown';
            return (
              <Card key={r.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{name || 'Unknown'}</Text>
                    {p?.email && <Text style={styles.requestEmail}>{p.email}</Text>}
                  </View>
                  <StatusPill status="pending" />
                </View>

                <Text style={styles.requestDate}>
                  Applied {new Date(r.created_at).toLocaleDateString()}
                </Text>

                <View style={styles.actionRow}>
                  <Button
                    variant="accent"
                    label="Approve"
                    onPress={() => updateRequest(r.id, 'approved')}
                    loading={processing === r.id}
                  />
                  <Button
                    variant="destructive"
                    label="Reject"
                    onPress={() => updateRequest(r.id, 'rejected')}
                    loading={processing === r.id}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  requestCard: { gap: 12 },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: '#FFFFFF' },
  requestInfo: { flex: 1 },
  requestName: { fontFamily: FontFamily.manropeExtraBold, fontSize: 15, color: Colors.navy },
  requestEmail: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  requestDate: { fontFamily: FontFamily.interRegular, fontSize: FontSize.min, color: Colors.textMuted },
  actionRow: { flexDirection: 'row', gap: 12 },
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/(admin)/
git commit -m "feat: admin screens — ManageAmenities, ManageCourts, PendingRequests"
```

---

## Task 12: Resident Navigation + Screens 6–7

**Files:**
- Create: `src/app/(resident)/_layout.tsx`
- Create: `src/app/(resident)/index.tsx`
- Create: `src/app/(resident)/report.tsx`

- [ ] **Step 1: Create `src/app/(resident)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router';
import { Home, Calendar, FileText, BookOpen, FolderOpen } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';

export default function ResidentLayout() {
  return (
    <Tabs tabBar={(props) => <BottomNav {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.5} /> }} />
      <Tabs.Screen name="book" options={{ title: 'Book', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={1.5} /> }} />
      <Tabs.Screen name="report" options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} strokeWidth={1.5} /> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.5} /> }} />
      <Tabs.Screen name="docs" options={{ title: 'Docs', tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} strokeWidth={1.5} /> }} />
    </Tabs>
  );
}
```

Create stub screens for unbuilt resident tabs:
```bash
# src/app/(resident)/book.tsx
# src/app/(resident)/calendar.tsx
# src/app/(resident)/docs.tsx
```

Each stub:
```typescript
import { View } from 'react-native';
import { Colors } from '@/constants/design';
export default function StubScreen() {
  return <View style={{ flex: 1, backgroundColor: Colors.pageBg }} />;
}
```

- [ ] **Step 2: Create `src/app/(resident)/index.tsx` — Resident Home + Booking Flow**

```typescript
import { useEffect, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native';
import { BookOpen, CheckCircle } from 'lucide-react-native';
import { addDays, startOfDay } from 'date-fns';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export default function ResidentHomeScreen() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [bookedHours, setBookedHours] = useState<number[]>([]);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [booking, setBooking] = useState(false);
  const [userName, setUserName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [myBookings, setMyBookings] = useState<(Booking & { court?: Court })[]>([]);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from('profiles').select('first_name').eq('id', user.id).single();
      if (p?.first_name) setUserName(p.first_name);
      const { data: bk } = await supabase.from('bookings').select('*, courts(*)').eq('user_id', user.id).gte('start_time', new Date().toISOString()).order('start_time');
      setMyBookings((bk ?? []) as any[]);
    }
    const { data: c } = await supabase.from('courts').select('*').order('name');
    setCourts(c ?? []);
    if (!selectedCourt && c && c.length > 0) setSelectedCourt(c[0]);
  }

  async function loadSlots() {
    if (!selectedCourt) return;
    const dayEnd = addDays(selectedDate, 1);
    const { data } = await supabase.from('bookings').select('start_time').eq('court_id', selectedCourt.id).gte('start_time', selectedDate.toISOString()).lt('start_time', dayEnd.toISOString());
    setBookedHours((data ?? []).map((b) => new Date(b.start_time).getHours()));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadSlots(); }, [selectedCourt, selectedDate]);

  async function confirmBooking() {
    if (!selectedCourt || selectedHour === null) return;
    setBooking(true);
    const { data: { user } } = await supabase.auth.getUser();
    const startTime = new Date(selectedDate);
    startTime.setHours(selectedHour, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    await supabase.from('bookings').insert({
      court_id: selectedCourt.id,
      user_id: user?.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'confirmed',
    });
    setBooking(false);
    setShowConfirm(false);
    setSelectedHour(null);
    loadSlots();
    load();
  }

  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <View style={styles.screen}>
      <Header
        variant="resident-home"
        greeting={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}${userName ? ', ' + userName : ''}!`}
        subCopy="Book a court or track your reservations."
        avatarInitials={userName.charAt(0).toUpperCase() || 'U'}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={Colors.accentCyan} />}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          <Text style={styles.sectionTitle}>Book a Court</Text>

          {/* Court selector */}
          <Text style={styles.label}>AMENITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {courts.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.pill, selectedCourt?.id === c.id && styles.pillActive]} onPress={() => setSelectedCourt(c)}>
                <Text style={[styles.pillLabel, selectedCourt?.id === c.id && styles.pillLabelActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date selector */}
          <Text style={styles.label}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {dates.map((d) => {
              const isActive = d.toDateString() === selectedDate.toDateString();
              return (
                <TouchableOpacity key={d.toISOString()} style={[styles.dateBtn, isActive && styles.dateBtnActive]} onPress={() => setSelectedDate(d)}>
                  <Text style={[styles.dateDow, isActive && { color: '#FFF' }]}>{DAYS_SHORT[d.getDay()]}</Text>
                  <Text style={[styles.dateDay, isActive && { color: '#FFF' }]}>{d.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time slots */}
          <Text style={styles.label}>AVAILABLE TIMES</Text>
          <View style={styles.slotsGrid}>
            {HOURS.map((h) => {
              const isBooked = bookedHours.includes(h);
              const isSelected = selectedHour === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.slot, isBooked && styles.slotBooked, isSelected && styles.slotSelected]}
                  onPress={() => { if (!isBooked) { setSelectedHour(h); setShowConfirm(true); } }}
                  disabled={isBooked}>
                  <Text style={[styles.slotText, isBooked && styles.slotTextBooked, isSelected && { color: '#FFF' }]}>
                    {h > 12 ? `${h - 12}pm` : h === 12 ? '12pm' : `${h}am`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Upcoming bookings */}
          {myBookings.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.sectionGap }]}>Upcoming Bookings</Text>
              {myBookings.map((b) => (
                <Card key={b.id} accent="optimal" style={styles.bookingCard}>
                  <Text style={styles.bookingCourt}>{(b as any).courts?.name ?? 'Court'}</Text>
                  <Text style={styles.bookingTime}>
                    {new Date(b.start_time).toLocaleDateString()} · {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Card>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* Booking confirmation modal */}
      <Modal visible={showConfirm} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowConfirm(false)}>
        <SafeAreaView style={styles.confirmModal}>
          <CheckCircle color={Colors.accentCyan} size={48} strokeWidth={1.5} style={{ alignSelf: 'center' }} />
          <Text style={styles.confirmTitle}>Confirm Booking</Text>
          <Text style={styles.confirmDetail}>{selectedCourt?.name}</Text>
          <Text style={styles.confirmDetail}>
            {selectedDate.toLocaleDateString()} at {selectedHour && selectedHour > 12 ? `${selectedHour - 12}:00 PM` : `${selectedHour}:00 AM`}
          </Text>
          <View style={styles.confirmActions}>
            <Button variant="ghost" label="Cancel" onPress={() => setShowConfirm(false)} />
            <Button variant="accent" label="Book Now" onPress={confirmBooking} loading={booking} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  sectionTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy },
  label: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  pillRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, marginBottom: 8 },
  pill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.cardBg },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  pillLabelActive: { color: '#FFFFFF' },
  dateBtn: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center', minWidth: 52, backgroundColor: Colors.cardBg },
  dateBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dateDow: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted },
  dateDay: { fontFamily: FontFamily.manropeBold, fontSize: 18, color: Colors.navy },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  slot: { borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.accentCyan, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', backgroundColor: Colors.optimalBg, minWidth: '22%' },
  slotBooked: { backgroundColor: Colors.attentionBg, borderColor: Colors.coral },
  slotSelected: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  slotText: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.blueMid },
  slotTextBooked: { color: '#92400E' },
  bookingCard: { gap: 4 },
  bookingCourt: { fontFamily: FontFamily.manropeExtraBold, fontSize: 15, color: Colors.navy },
  bookingTime: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  confirmModal: { flex: 1, padding: Spacing.pagePx, backgroundColor: Colors.cardBg, gap: 12, alignItems: 'stretch', justifyContent: 'center' },
  confirmTitle: { fontFamily: FontFamily.manropeBlack, fontSize: FontSize.sectionTitle, color: Colors.navy, textAlign: 'center', marginTop: 12 },
  confirmDetail: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textSubtle, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
```

- [ ] **Step 3: Create `src/app/(resident)/report.tsx` — Issue Reporting**

```typescript
import { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];

const CATEGORIES = ['plumbing', 'electrical', 'structural', 'cleanliness', 'equipment', 'safety', 'other'] as const;
type Category = typeof CATEGORIES[number];

export default function ReportIssueScreen() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [category, setCategory] = useState<Category>('other');
  const [amenityId, setAmenityId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase.from('courts').select('*').order('name').then(({ data }) => setCourts(data ?? []));
  }, []);

  async function submit() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Please enter a title for the issue.');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('maintenance_reports').insert({
      title: title.trim(),
      description: description.trim() || null,
      category,
      court_id: amenityId || null,
      reported_by: user?.id,
      status: 'open',
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <CheckCircle color={Colors.accentCyan} size={64} strokeWidth={1.5} />
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successSub}>We'll look into it as soon as possible.</Text>
        <Button variant="primary" label="Done" onPress={() => { setSubmitted(false); setTitle(''); setDescription(''); router.back(); }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Report Issue" onBack={() => router.back()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center', gap: 16 }}>

          {/* Category */}
          <View>
            <Text style={styles.label}>CATEGORY <Text style={{ color: Colors.coral }}>*</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.pill, category === c && styles.pillActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.pillLabel, category === c && styles.pillLabelActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Amenity */}
          <View>
            <Text style={styles.label}>AMENITY (OPTIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              <TouchableOpacity style={[styles.pill, amenityId === null && styles.pillActive]} onPress={() => setAmenityId(null)}>
                <Text style={[styles.pillLabel, amenityId === null && styles.pillLabelActive]}>None</Text>
              </TouchableOpacity>
              {courts.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pill, amenityId === c.id && styles.pillActive]} onPress={() => setAmenityId(c.id)}>
                  <Text style={[styles.pillLabel, amenityId === c.id && styles.pillLabelActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Title */}
          <View>
            <Text style={styles.label}>TITLE <Text style={{ color: Colors.coral }}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Brief description of the issue"
              placeholderTextColor={Colors.textPlaceholder}
            />
          </View>

          {/* Description */}
          <View>
            <Text style={styles.label}>DETAILS (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide additional context…"
              placeholderTextColor={Colors.textPlaceholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <Button variant="accent" label="Submit Report" onPress={submit} loading={submitting} fullWidth />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 100 },
  label: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  pillRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  pill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.cardBg },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  pillLabelActive: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input, padding: 14, fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.cardBg, minHeight: Spacing.tapTarget },
  textarea: { minHeight: 100, paddingTop: 14 },
  successTitle: { fontFamily: FontFamily.manropeBlack, fontSize: 24, color: Colors.navy },
  successSub: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(resident)/
git commit -m "feat: resident screens — home/booking flow and issue reporting"
```

---

## Task 13: Cleanup + Final Compile Check

**Files:**
- Delete: old template files that are no longer referenced
- Verify: all imports resolve, TypeScript passes

- [ ] **Step 1: Remove old template files**

```bash
# These are superseded by the new route structure
# Only delete if they are no longer imported anywhere
```

Check if these are still imported:
```bash
grep -r "app/index" src/ --include="*.tsx" --include="*.ts"
grep -r "app/explore" src/ --include="*.tsx" --include="*.ts"
grep -r "app-tabs" src/ --include="*.tsx" --include="*.ts"
grep -r "constants/theme" src/ --include="*.tsx" --include="*.ts"
```

Delete any file that shows 0 references in the above grep:
- `src/app/index.tsx`
- `src/app/explore.tsx`
- `src/components/app-tabs.tsx`
- `src/components/app-tabs.web.tsx`
- `src/constants/theme.ts`

- [ ] **Step 2: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Fix any type errors before proceeding.

- [ ] **Step 3: Run expo export to verify the bundle compiles**

```bash
npx expo export --platform web 2>&1 | tail -20
```

Expected: `Export was successful` with no module resolution errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove old template files, verify full compile"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ AdminHub — Task 9
- ✅ MaintenanceReports — Task 10
- ✅ ManageAmenities — Task 11
- ✅ ManageCourts — Task 11
- ✅ PendingRequests — Task 11
- ✅ Resident booking flow — Task 12
- ✅ Resident issue reporting — Task 12
- ✅ Design tokens — Task 2
- ✅ Supabase client + types — Task 3
- ✅ Font loading — Task 4
- ✅ Auth gate — Task 4
- ✅ All shared UI components — Tasks 5–7
- ✅ Navigation (CM tabs, admin stack, resident tabs) — Tasks 8, 11, 12

**Type consistency:**
- `getHealthColor(score)` defined in Task 2, used in Tasks 9 and 5 ✅
- `getHealthAccent(score)` defined in Task 2, used in Task 9 ✅
- `FontFamily.interSemiBold` defined in Task 2 — note: Button.tsx uses `FontFamily.interSemiBold` but the constant is named `FontFamily.interSemiBold`. ✅
- `Database['public']['Tables']['hoas']['Row']` — verify `hoas` exists in the fetched types.ts. If it's `communities` instead, update Task 9 query.
- `community_join_requests` table — verify column `status` accepts `'approved' | 'rejected'` and `created_at` exists.
- `maintenance_reports` — verify `title`, `description`, `category`, `status`, `admin_notes`, `court_id`, `reported_by` columns exist.

**`date-fns` note:** Tasks 11 and 12 use `date-fns`. If preferred not to install, use vanilla JS date arithmetic (documented in Task 11).

**BottomNav note:** The `BottomNav` component uses `@react-navigation/bottom-tabs` types. This package is a dependency of `expo-router` and is available without explicit install — but if TypeScript can't find the type, add: `import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'`.
