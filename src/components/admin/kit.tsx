import { Children, cloneElement, isValidElement, ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView,
  StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Bell, Menu, type LucideIcon } from 'lucide-react-native';

import {
  A, ADMIN_BOTTOM_PAD, ADMIN_MAX_WIDTH, ADMIN_PAGE_PX, AShadow, STATUS_LABEL, STATUS_TONE, TONES, type Tone,
} from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import { TenisXLogo } from '@/components/branding/BrandLogos';

// ─── Header ──────────────────────────────────────────────────────────────────
// Compact navy band (~56pt + safe area). The white TenisX wordmark is drawn
// straight onto the navy — no container around it.

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBell?: boolean;
  showMenu?: boolean;
  unread?: number;
  community?: { hoaId?: string; name?: string; logoUrl?: string | null };
  right?: ReactNode;
}

export function AdminHeader({
  title, subtitle, onBack, showBell = true, showMenu = false, unread = 0, community, right,
}: AdminHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 6 }]}>
      <View style={s.headerRow}>
        {onBack ? (
          <IconButton label="Back" onPress={onBack} Icon={ArrowLeft} dark />
        ) : (
          <TenisXLogo height={26} testID="tenisx-logo" />
        )}
        <View style={s.headerTitleWrap}>
          {community?.name ? (
            <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">{community.name}</Text>
          ) : title ? (
            <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
          ) : null}
        </View>
        {right}
        {showBell && (
          <View>
            <IconButton label="Notifications" onPress={() => router.push('/notifications')} Icon={Bell} dark />
            {unread > 0 && (
              <View style={s.badge} pointerEvents="none">
                <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
        )}
        {showMenu && <IconButton label="Menu" onPress={() => router.push('/settings')} Icon={Menu} dark />}
      </View>
      {subtitle ? <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

export function IconButton({
  Icon, onPress, label, dark,
}: { Icon: LucideIcon; onPress: () => void; label: string; dark?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}>
      <Icon size={22} strokeWidth={1.75} color={dark ? '#FFFFFF' : A.text} />
    </Pressable>
  );
}

// ─── Screen scaffold ─────────────────────────────────────────────────────────

interface AdminScreenProps {
  header?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Render children without a ScrollView (e.g. screens owning a FlatList). */
  noScroll?: boolean;
  testID?: string;
}

export function AdminScreen({ header, children, refreshing, onRefresh, noScroll, testID }: AdminScreenProps) {
  const body = noScroll ? (
    <View style={[s.content, { flex: 1 }]}>{children}</View>
  ) : (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={A.primary} />
      ) : undefined}>
      <View style={s.content}>{children}</View>
    </ScrollView>
  );
  return (
    <KeyboardAvoidingView
      testID={testID}
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {body}
    </KeyboardAvoidingView>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────────

export function Card({
  children, style, onPress, accessibilityLabel, testID,
}: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; testID?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle} accessibilityRole="header">{children}</Text>
      {action}
    </View>
  );
}

export function Pill({ label, tone = 'neutral', Icon }: { label: string; tone?: Tone; Icon?: LucideIcon }) {
  const t = TONES[tone];
  return (
    <View style={[s.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      {Icon ? <Icon size={12} color={t.fg} strokeWidth={2} /> : null}
      <Text style={[s.pillText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Pill label={STATUS_LABEL[status] ?? status} tone={STATUS_TONE[status] ?? 'neutral'} />;
}

export function Chip({
  label, selected, onPress, count, testID,
}: { label: string; selected?: boolean; onPress: () => void; count?: number; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[s.chip, selected && s.chipSelected]}>
      <Text style={[s.chipText, selected && s.chipTextSelected]}>
        {label}{typeof count === 'number' ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipRow}
      style={{ flexGrow: 0 }}>
      {children}
    </ScrollView>
  );
}

export function MetricCard({
  value, label, Icon, onPress, tone = 'info', testID, columns = 2,
}: { value: number | string; label: string; Icon: LucideIcon; onPress?: () => void; tone?: Tone; testID?: string; columns?: 2 | 3 }) {
  const t = TONES[tone];
  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={`${label}: ${value}`}
      style={[s.metric, columns === 3 && s.metric3]}>
      <View style={[s.metricIcon, { backgroundColor: t.bg }]}>
        <Icon size={18} color={t.fg} strokeWidth={1.75} />
      </View>
      <Text style={s.metricValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      <Text style={s.metricLabel} numberOfLines={2}>{label}</Text>
    </Card>
  );
}

/** Two-column grid that keeps cards equal width and wraps cleanly under text scaling. */
export function MetricGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <View style={s.metricGrid}>
      {Children.map(children, (c) => (isValidElement(c) ? cloneElement(c as ReactElement<{ columns?: 2 | 3 }>, { columns }) : c))}
    </View>
  );
}

/** Equal-width segmented control: every option stays visible (no horizontal scrolling or clipping). */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; testID?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segWrap} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={o.testID}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.segItem, on && s.segItemOn]}>
            <Text style={[s.segText, on && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({
  label, onPress, variant = 'primary', loading, disabled, Icon, testID,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean; disabled?: boolean; Icon?: LucideIcon; testID?: string;
}) {
  const off = disabled || loading;
  const bg = off ? A.disabledBg
    : variant === 'primary' ? A.primary
    : variant === 'danger' ? A.error
    : variant === 'secondary' ? A.surface : 'transparent';
  const fg = off ? A.textMuted
    : variant === 'primary' || variant === 'danger' ? A.onPrimary
    : variant === 'secondary' ? A.primary : A.primary;
  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' && !off ? A.primary : 'transparent' },
        pressed && !off && { opacity: 0.85 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {Icon ? <Icon size={18} color={fg} strokeWidth={2} /> : null}
          <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Accessible on/off switch: whole row is the tap target (>= 48pt), announces as a switch. */
export function Toggle({
  value, onChange, label, hint, disabled, testID,
}: { value: boolean; onChange: (next: boolean) => void; label: string; hint?: string; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : () => onChange(!value)}
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[s.toggleRow, disabled && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {hint ? <Text style={s.toggleHint}>{hint}</Text> : null}
      </View>
      <View style={[s.toggleTrack, { backgroundColor: value ? A.primary : A.borderStrong }]}>
        <View style={[s.toggleThumb, value ? { right: 3 } : { left: 3 }]} />
      </View>
    </Pressable>
  );
}

export function EmptyBlock({ Icon, title, body }: { Icon: LucideIcon; title: string; body?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon size={26} color={A.textMuted} strokeWidth={1.5} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: TONES.error.border, backgroundColor: A.errorBg }}>
      <Text style={[s.emptyTitle, { color: A.errorText, textAlign: 'left' }]}>Something went wrong</Text>
      <Text style={[s.emptyBody, { color: A.errorText, textAlign: 'left' }]}>{message}</Text>
      {onRetry ? <View style={{ marginTop: 12 }}><Button label="Try again" variant="secondary" onPress={onRetry} /></View> : null}
    </Card>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[s.card, { height: 84, backgroundColor: A.surfaceAlt, borderColor: A.border }]} />
      ))}
    </View>
  );
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: ADMIN_BOTTOM_PAD, flexGrow: 1 },
  content: {
    width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center',
    paddingHorizontal: ADMIN_PAGE_PX, paddingTop: 16, gap: 16,
  },

  header: { backgroundColor: A.navy, paddingHorizontal: ADMIN_PAGE_PX, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  headerTitleWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 4 },
  headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: '#FFFFFF', letterSpacing: -0.3 },
  headerSub: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: '#C9D6EE', marginTop: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: A.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontFamily: FontFamily.manropeBold, fontSize: 11, color: '#FFFFFF' },

  card: {
    backgroundColor: A.surface, borderRadius: 14, borderWidth: 1, borderColor: A.border,
    padding: 16, ...AShadow.card,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: A.text, letterSpacing: -0.2 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 0.3 },

  chipRow: { gap: 8, paddingVertical: 2, paddingRight: ADMIN_PAGE_PX },
  chip: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: A.border,
    backgroundColor: A.surface, alignItems: 'center', justifyContent: 'center',
  },
  chipSelected: { backgroundColor: A.navy, borderColor: A.navy },
  chipText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: A.textSecondary },
  chipTextSelected: { color: '#FFFFFF' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexBasis: '47%', flexGrow: 1, minHeight: 112, gap: 6, padding: 14 },
  metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metric3: { flexBasis: '30%', minHeight: 104, padding: 12 },
  segWrap: { flexDirection: 'row', backgroundColor: A.surfaceAlt, borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segItemOn: { backgroundColor: A.navy },
  segText: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: A.textSecondary },
  metricValue: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 30, color: A.text, letterSpacing: -0.5 },
  metricLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: A.textSecondary },

  button: {
    minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  buttonText: { fontFamily: FontFamily.manropeBold, fontSize: 15 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  toggleLabel: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: A.text },
  toggleHint: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textSecondary, marginTop: 2 },
  toggleTrack: { width: 52, height: 32, borderRadius: 16, justifyContent: 'center' },
  toggleThumb: { position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', ...AShadow.card },

  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: A.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: A.text, textAlign: 'center' },
  emptyBody: { fontFamily: FontFamily.manropeMedium, fontSize: 14, color: A.textSecondary, textAlign: 'center' },
});
