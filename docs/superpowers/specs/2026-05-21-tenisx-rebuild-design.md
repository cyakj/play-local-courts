# TenisX Native Rebuild — Design Spec
**Date:** 2026-05-21  
**Scope:** Stage 1 screens only  
**Stack:** Expo SDK 56 + React Native + Expo Router + StyleSheet API + Supabase JS

---

## 1. Overview

TenisX is an HOA community management mobile app for sports court bookings. This spec covers the native Expo rebuild of Stage 1 screens only. The reference codebase (React web + Capacitor at github.com/cyakj/play-local-courts) is used as a **feature specification only** — no web code is copied.

**Creative direction:** "The Digital Architect" — Lumina Slate  
**Platform:** iOS-first, 390px reference width, light mode only (no dark mode)  
**App Store target:** End of April 2026

---

## 2. Design System

All tokens live in `src/constants/design.ts`.

### Colors
```ts
Colors = {
  pageBg:      '#F9FAFB',
  cardBg:      '#FFFFFF',
  headerBg:    '#0F1F3D',  // Deep Navy
  accentCyan:  '#00D4FF',
  navy:        '#0F1F3D',
  border:      'rgba(15,31,61,0.08)',
  coral:       '#F97066',
  red:         '#EF4444',
  textPrimary: '#0F1F3D',
  textMuted:   '#8892A4',
  textSubtle:  '#4B5563',
  optimalBg:   '#E0F9FF',
  attentionBg: '#FFF5F5',
  criticalBg:  '#FEF2F2',
}
```

### Typography
- Headlines: **Manrope** (loaded via `expo-font`) — 900 for page titles, 800 for card/section titles
- Body/UI: **Inter** (loaded via `expo-font`) — 400 regular, 600 semibold
- Metadata: Inter 11px, 600 weight, ALL CAPS, letterSpacing: 1.2

### Radii & Spacing
- Card radius: 16px | Button radius: 12px | Pill radius: 99px
- Page horizontal padding: 20px | Card gap: 12px | Section gap: 16px
- Minimum tap target: 44px height

### Shadows (card)
```ts
shadowColor: '#0F1F3D',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.04,
shadowRadius: 8,
elevation: 2,
```

---

## 3. Architecture

### File Structure
```
src/
  app/
    _layout.tsx              ← root: font loading, Supabase provider, auth gate
    (auth)/
      login.tsx
    (cm)/
      _layout.tsx            ← CM tab bar (Portfolio · Issues · Calendar · Alerts)
      index.tsx              ← AdminHub (CMPortfolio)
      maintenance.tsx        ← MaintenanceReports
    (admin)/
      _layout.tsx            ← Admin stack navigator
      manage-amenities.tsx
      manage-courts.tsx
      pending-requests.tsx
    (resident)/
      _layout.tsx            ← Resident tab bar (Home · Book · Reports · Calendar · Docs)
      index.tsx              ← Resident home
      report.tsx             ← Issue reporting
  constants/
    design.ts                ← all design tokens (colors, typography, spacing, radii, shadows)
  lib/
    supabase.ts              ← typed Supabase client
  components/
    ui/
      Header.tsx             ← Variants: CMPortfolio, ResidentHome, InnerScreen
      Card.tsx               ← Base card with optional left-border accent
      StatusPill.tsx         ← Optimal / Needs Attention / Critical
      StatsGrid.tsx          ← 4-column stats row
      HealthBar.tsx          ← 4px progress bar, color-coded
      Button.tsx             ← Primary / Accent / Ghost / Destructive
      EmptyState.tsx
      Skeleton.tsx
      BottomNav.tsx          ← Glassmorphic nav for CM and Resident
```

### Data Layer
- `src/lib/supabase.ts`: single Supabase client, typed with Database from types.ts
- No TanStack Query in Stage 1 — direct `supabase.from(...).select(...)` calls with `useState` + `useEffect` per screen
- Real-time subscriptions only where reference screens used them (PendingRequests, MaintenanceReports)

### Auth
- Root `_layout.tsx` checks session; redirects unauthenticated users to `(auth)/login`
- Role detected from `user_roles` table → routes to correct tab group: `(cm)`, `(admin)`, or `(resident)`

---

## 4. Stage 1 Screens

### Screen 1: AdminHub — `(cm)/index.tsx`
**Source ref:** CMPortfolio.tsx  
**Header:** Variant 1 (CM Portfolio) — navy bg, TenisX logo, bell + menu icons, greeting, cyan sub-copy  
**Body:**
- Portfolio health score (large Manrope 900, cyan glow, color-coded)
- 4-col stats grid: Communities / Open Issues / Bookings / Pending
- Scrollable list of community cards (name + status pill, health bar, 4-col stats, Manage link)
- Skeleton loading state while data fetches  
**Tables:** `hoas`, `hoa_memberships`, `maintenance_reports`, `bookings`  
**Nav:** CM bottom tab (Portfolio · Issues · Calendar · Alerts)

### Screen 2: MaintenanceReports — `(cm)/maintenance.tsx`
**Source ref:** MaintenanceReports.tsx  
**Header:** Variant 3 (Inner Screen) — back arrow, "Maintenance Reports" title  
**Body:**
- Open + In-Progress count badges
- Filter pills: Status / Category / Amenity
- Scrollable report cards: title, category badge, priority badge, status pill, date
- Tap card → detail sheet: full description, assignee search, status update, admin notes  
**Tables:** `maintenance_reports`, `courts` (for amenity filter)  
**Real-time:** Yes — subscription on `maintenance_reports`

### Screen 3: ManageAmenities — `(admin)/manage-amenities.tsx`
**Source ref:** ManageCourts.tsx (amenity management section)  
**Header:** Variant 3 — back arrow, "Manage Amenities"  
**Body:**
- List of amenities with type icon + label (Tennis, Pickleball, Pool, Gym, Clubhouse, Barbecue, Jacuzzi)
- Add amenity FAB → modal: name, type select
- Tap amenity → expand: toggle active/inactive, delete  
**Tables:** `courts` (amenity_type column determines type)

### Screen 4: ManageCourts — `(admin)/manage-courts.tsx`
**Source ref:** ManageCourts.tsx (scheduling section)  
**Header:** Variant 3 — back arrow, "Manage Courts"  
**Body:**
- Amenity selector (horizontal scroll pills)
- 7-day date carousel (today + 6 days forward)
- Time slot grid for selected amenity + date: Available / Booked / Maintenance
- Tap slot to toggle status  
**Tables:** `courts`, `bookings`

### Screen 5: PendingRequests — `(admin)/pending-requests.tsx`
**Source ref:** PendingRequests.tsx  
**Header:** Variant 3 — back arrow, "Pending Requests" + count badge  
**Body:**
- Request cards: name, email, phone, DOB (optional), application date, status pill
- Approve / Reject action buttons (min 44px, primary + destructive styles)
- Empty state when count = 0  
**Tables:** `community_join_requests`, `profiles`  
**Real-time:** Yes — subscription on `community_join_requests`

### Screen 6: Resident Booking Flow — `(resident)/index.tsx`
**Header:** Variant 2 (Resident Home) — avatar, bell  
**Body:**
- Available courts list for today (filtered by HOA)
- 7-day date selector
- Time slot picker
- Booking confirmation sheet  
**Tables:** `courts`, `bookings`

### Screen 7: Resident Issue Reporting — `(resident)/report.tsx`
**Header:** Variant 3 — back arrow, "Report Issue"  
**Body:**
- Category select (dropdown)
- Amenity select (dropdown, filtered by HOA)
- Title input
- Description textarea
- Submit → inserts into `maintenance_reports`  
**Tables:** `maintenance_reports`, `courts`

---

## 5. Shared UI Components

All components use `StyleSheet.create` with imported design tokens. No inline style objects with magic values.

### Header.tsx
Three variants driven by a `variant` prop: `'cm-portfolio' | 'resident-home' | 'inner'`. Navy background (`#0F1F3D`), handles iOS safe area top inset via `useSafeAreaInsets`.

### Card.tsx
```ts
interface CardProps {
  children: React.ReactNode;
  accent?: 'optimal' | 'attention' | 'critical' | 'none';
  onPress?: () => void;
}
```
Left border applied only when `accent !== 'none'`. Base shadow always applied.

### StatusPill.tsx
```ts
interface StatusPillProps {
  status: 'optimal' | 'needs-attention' | 'critical' | 'pending' | 'approved' | 'rejected';
}
```

### StatsGrid.tsx
```ts
interface StatsGridProps {
  stats: Array<{ value: string | number; label: string }>;
}
```
Always 4 items, `flexDirection: 'row'`, equal `flex: 1` per column.

### HealthBar.tsx
4px height, color from `getHealthColor(score)`, animated width via `Animated.Value`.

### Button.tsx
```ts
type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'destructive';
interface ButtonProps {
  variant: ButtonVariant;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}
```

---

## 6. Dependencies to Add

```
@supabase/supabase-js
@react-native-async-storage/async-storage   ← Supabase auth session storage
expo-font                                    ← already in SDK, just add useFonts call
lucide-react-native                         ← SVG stroke icons
react-native-svg                            ← peer dep for lucide-react-native
```

NativeWind, Tamagui, and any CSS-in-JS library are **not used**.

---

## 7. Rules

- Light mode only — never use `dark:` variants or `useColorScheme` for theme switching
- No emoji anywhere — SVG stroke icons only (Lucide)
- No implicit `any` — all Supabase queries typed with Database generics
- All interactive elements min 44px height
- No placeholder comments or TODO items in final code
- Max content width: 480px (`maxWidth: 480, alignSelf: 'center', width: '100%'`)
- Dark mode disabled: `_layout.tsx` forces `colorScheme='light'` via `expo-system-ui`
