import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, LogOut, Repeat, Users } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { useProfileIdentity } from '@/hooks/useProfileIdentity';
import { useActiveCommunity } from '@/hooks/useActiveCommunity';
import { confirmAndSignOut } from '@/lib/authActions';
import {
  availableShells, currentShell, showSwitchCommunity, showSwitchRole, type Shell,
} from '@/lib/accountMenu';

/**
 * Top-right avatar menu: who is signed in, the active community, community / role switching (only when the backend
 * grants more than one) and sign out. Account settings are NOT repeated here: the bottom "Me" tab is the one destination.
 */
export function AccountMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const segments = useSegments();
  const identity = useProfileIdentity();
  const { community, communities, setActive } = useActiveCommunity();

  const [shells, setShells] = useState<Shell[]>([]);
  const [openList, setOpenList] = useState<'community' | 'role' | null>(null);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  // Roles are read from the backend each time the menu opens; nothing about roles is cached client-side.
  useEffect(() => {
    if (!visible) { setOpenList(null); setError(''); return; }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [rolesRes, memRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved').limit(1),
      ]);
      if (cancelled) return;
      const roles = (rolesRes.data ?? []).map((r: { role: string }) => r.role);
      setShells(availableShells(roles, (memRes.data ?? []).length > 0));
    })().catch(() => { if (!cancelled) setShells([]); });
    return () => { cancelled = true; };
  }, [visible]);

  const here = currentShell(segments[0]);
  const canSwitchCommunity = showSwitchCommunity(communities.length);
  const canSwitchRole = showSwitchRole(shells);

  async function chooseCommunity(hoaId: string) {
    if (switching) return;
    setSwitching(true);
    const ok = await setActive(hoaId); // only communities the backend returned as approved memberships
    setSwitching(false);
    if (!ok) { setError('That community is not available for your account.'); return; }
    onClose();
  }

  function chooseShell(shell: Shell) {
    onClose();
    if (shell.key !== here) router.replace(shell.href as never);
  }

  function signOut() {
    setError('');
    confirmAndSignOut((m) => setError(`Sign out failed: ${m}`));
  }

  const s = styles(theme);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      {/* Bounded to the visible window: a long community list scrolls inside the panel so Sign Out
          always stays reachable, even on short or landscape screens. */}
      <View testID="account-menu" style={[s.panel, { top: Math.max(insets.top, 24) + 52, maxHeight: Math.max(220, winH - (Math.max(insets.top, 24) + 52) - Math.max(insets.bottom, 12) - 12) }]}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.identityRow}>
          <ProfileAvatar photoUrl={identity.photoUrl} initials={identity.initials} size={44} onLoadError={identity.refresh} />
          <View style={{ flex: 1 }}>
            <Text testID="account-menu-name" style={s.name} numberOfLines={1}>{identity.fullName || 'Your account'}</Text>
            {community?.name ? (
              <Text testID="account-menu-community" style={s.sub} numberOfLines={1}>{community.name}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.divider} />

        {canSwitchCommunity && (
          <>
            <MenuRow
              testID="menu-switch-community"
              s={s} theme={theme}
              icon={<Users size={18} color={theme.textSecondary} strokeWidth={1.5} />}
              label="Switch Community"
              trailing={<ChevronDown size={16} color={theme.textMuted} strokeWidth={1.5} />}
              onPress={() => setOpenList(openList === 'community' ? null : 'community')}
            />
            {openList === 'community' && communities.map((c) => (
              <TouchableOpacity
                key={c.hoaId}
                testID={`menu-community-${c.hoaId}`}
                style={s.subRow}
                onPress={() => chooseCommunity(c.hoaId)}
                accessibilityRole="button"
                accessibilityState={{ selected: c.hoaId === community?.hoaId }}>
                <Text style={[s.subRowText, c.hoaId === community?.hoaId && { color: Colors.blue }]} numberOfLines={1}>{c.name}</Text>
                {c.hoaId === community?.hoaId ? <Check size={16} color={Colors.blue} strokeWidth={2} /> : null}
              </TouchableOpacity>
            ))}
          </>
        )}

        {canSwitchRole && (
          <>
            <MenuRow
              testID="menu-switch-role"
              s={s} theme={theme}
              icon={<Repeat size={18} color={theme.textSecondary} strokeWidth={1.5} />}
              label="Switch Role"
              trailing={<ChevronDown size={16} color={theme.textMuted} strokeWidth={1.5} />}
              onPress={() => setOpenList(openList === 'role' ? null : 'role')}
            />
            {openList === 'role' && shells.map((sh) => (
              <TouchableOpacity
                key={sh.key}
                testID={`menu-role-${sh.key}`}
                style={s.subRow}
                onPress={() => chooseShell(sh)}
                accessibilityRole="button"
                accessibilityState={{ selected: sh.key === here }}>
                <Text style={[s.subRowText, sh.key === here && { color: Colors.blue }]}>{sh.label}</Text>
                {sh.key === here ? <Check size={16} color={Colors.blue} strokeWidth={2} /> : null}
              </TouchableOpacity>
            ))}
          </>
        )}

        <MenuRow
          testID="menu-sign-out"
          s={s} theme={theme}
          icon={<LogOut size={18} color={Colors.negative} strokeWidth={1.5} />}
          label="Sign Out"
          danger
          onPress={signOut}
        />

        {!!error && <Text testID="account-menu-error" style={s.error}>{error}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

function MenuRow({ s, theme, icon, label, trailing, onPress, danger, testID }: {
  s: ReturnType<typeof styles>; theme: ReturnType<typeof useTheme>['theme'];
  icon: React.ReactNode; label: string; trailing?: React.ReactNode; onPress: () => void; danger?: boolean; testID: string;
}) {
  return (
    <TouchableOpacity testID={testID} style={s.row} onPress={onPress} accessibilityRole="button" activeOpacity={0.7}>
      {icon}
      <Text style={[s.rowText, { color: danger ? Colors.negative : theme.textPrimary }]}>{label}</Text>
      {trailing}
    </TouchableOpacity>
  );
}

function styles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,10,17,0.45)' },
    panel: {
      position: 'absolute', right: 12, width: 300, maxWidth: '94%',
      backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1, borderColor: theme.border,
      paddingVertical: 8, ...theme.shadowElevated,
    },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    name: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 17, color: theme.textPrimary },
    sub: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 48 },
    rowText: { flex: 1, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    subRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: 46, paddingRight: 16, minHeight: 44,
    },
    subRowText: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textSecondary },
    error: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: Colors.negative, paddingHorizontal: 16, paddingVertical: 8 },
  });
}
