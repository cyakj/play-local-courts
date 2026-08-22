import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ArrowLeft, Menu, MessageCircle } from 'lucide-react-native';

import { Colors, FontFamily, FontSize } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { isCommunityMode, isTennisMode } from '@/config/productMode';

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

interface ResidentHeaderProps {
  variant: 'resident';
  onBell?: () => void;
  onMessages?: () => void;
  onAvatar?: () => void;
  communityName?: string;
}

interface CoachHeaderProps {
  variant: 'coach';
  onBell?: () => void;
  onMessages?: () => void;
  onSettings?: () => void;
  communityName?: string;
}

interface AdminHeaderProps {
  variant: 'admin';
  /** Screen title, e.g. "Alerts", "Calendar", "Maintenance", "Messages". */
  title: string;
  /** Set when the screen is scoped to a single HOA — shown as the primary identity. */
  communityName?: string;
  /** Renders a back arrow when provided; omit for top-level admin screens. */
  onBack?: () => void;
  onBell?: () => void;
  /** Renders the messages icon when provided. */
  onMessages?: () => void;
  /** Unread badge shown on the messages icon when > 0. */
  unreadMessagesCount?: number;
}

type HeaderProps =
  | CMPortfolioHeaderProps
  | ResidentHomeHeaderProps
  | InnerScreenHeaderProps
  | ResidentHeaderProps
  | CoachHeaderProps
  | AdminHeaderProps;

function useProfileInitials(): string {
  const [initials, setInitials] = useState('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data?.full_name) return;
          const parts = (data.full_name as string).trim().split(' ').filter(Boolean);
          setInitials((parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase());
        });
    });
  }, []);
  return initials;
}

export function Header(props: HeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 24);
  const { theme } = useTheme();
  const profileInitials = useProfileInitials();

  if (props.variant === 'resident' || props.variant === 'coach') {
    const isCoach = props.variant === 'coach';
    const avatarDest = isCoach ? '/(coach)/me' : '/(resident)/me';
    const onMessages = isCoach
      ? ((props as CoachHeaderProps).onMessages ?? (() => router.push('/messages' as any)))
      : ((props as ResidentHeaderProps).onMessages ?? (() => router.push('/messages' as any)));
    const onAvatar = isCoach
      ? (() => router.push('/(coach)/me' as any))
      : ((props as ResidentHeaderProps).onAvatar ?? (() => router.push('/(resident)/me' as any)));
    return (
      <View style={[styles.base, styles.residentBase, { paddingTop: topPad + 8, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={[styles.topBar, styles.residentTopBar]}>
          {isCommunityMode ? (
            <View testID="community-wordmark" style={styles.residentLogoWrap}>
              <Text style={styles.communityWordmark} numberOfLines={1}>
                {(props as ResidentHeaderProps | CoachHeaderProps).communityName ?? 'Community'}
              </Text>
              <Text style={styles.poweredBy} numberOfLines={1}>
                Powered by TenisX
              </Text>
            </View>
          ) : (
            <View testID="tenisx-logo" style={styles.residentLogoWrap}>
              <Image
                source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
                style={styles.residentLogo}
                resizeMode="contain"
              />
            </View>
          )}
          <View style={styles.topBarRight}>
            {/* Messages — tennis-only: /messages is match-invite content with no
                Community-mode equivalent (see Header.tsx Finding 4, community-mode-ia fix wave). */}
            {isTennisMode && (
              <TouchableOpacity
                testID="messages-icon"
                style={styles.iconBtn}
                onPress={onMessages}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <MessageCircle color="#FFFFFF" size={22} strokeWidth={1.5} />
              </TouchableOpacity>
            )}

            {/* Notifications bell */}
            <TouchableOpacity
              testID="bell-icon"
              style={styles.iconBtn}
              onPress={props.onBell ?? (() => router.push('/notifications'))}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
            </TouchableOpacity>

            {/* Avatar — rightmost, navigates to Me/profile */}
            <TouchableOpacity
              testID="avatar-icon"
              style={styles.iconBtn}
              onPress={onAvatar}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarCircleText}>{profileInitials || '?'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (props.variant === 'inner') {
    return (
      <View style={[styles.base, { paddingTop: topPad + 8, paddingBottom: 20 }]}>
        <View style={styles.innerRow}>
          {props.onBack ? (
            <TouchableOpacity
              onPress={props.onBack}
              style={styles.iconBtn}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <ArrowLeft color="#FFFFFF" size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Text style={styles.innerTitle} numberOfLines={1}>
            {props.title}
          </Text>
          <View style={styles.iconBtn}>{props.rightIcon ?? null}</View>
        </View>
      </View>
    );
  }

  if (props.variant === 'admin') {
    const unread = props.unreadMessagesCount ?? 0;
    return (
      <View style={[styles.base, styles.adminBase, { paddingTop: topPad + 8 }]}>
        <View style={styles.topBar}>
          {props.onBack ? (
            <TouchableOpacity
              onPress={props.onBack}
              style={styles.iconBtn}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <ArrowLeft color="#FFFFFF" size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <View style={styles.topBarRight}>
            {props.onMessages && (
              <TouchableOpacity
                testID="messages-icon"
                style={[styles.iconBtn, styles.iconBtnRelative]}
                onPress={props.onMessages}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <MessageCircle color="#FFFFFF" size={22} strokeWidth={1.5} />
                {unread > 0 && (
                  <View style={styles.msgBadge}>
                    <Text style={styles.msgBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="bell-icon"
              style={styles.iconBtn}
              onPress={props.onBell}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.adminEyebrow} numberOfLines={1}>
          {props.title.toUpperCase()}
        </Text>
        <Text style={styles.adminIdentity} numberOfLines={1}>
          {props.communityName ?? 'TenisX'}
        </Text>
        {props.communityName && (
          <Text style={styles.poweredBy} numberOfLines={1}>
            Powered by TenisX
          </Text>
        )}
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
            <Text style={styles.avatarText}>
              {(props as ResidentHomeHeaderProps).avatarInitials ?? 'U'}
            </Text>
          </View>
        )}
        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={props.onBell}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          {isCM && (
            <TouchableOpacity
              onPress={(props as CMPortfolioHeaderProps).onMenu}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Menu color="#FFFFFF" size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.welcomeTag}>WELCOME BACK</Text>
      <Text style={styles.greeting}>{props.greeting}</Text>
      <Text style={styles.subCopy}>{props.subCopy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    // Court gradient: #0F2A57 → #081427 → #080A11
    // LinearGradient not used here — solid approximation for non-resident variants
    backgroundColor: Colors.courtBlue,
    paddingHorizontal: 20,
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
    gap: 8,
    alignItems: 'center',
  },
  residentBase: {
    backgroundColor: '#0A1628',
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 76,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45,224,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  residentTopBar: {
    marginBottom: 0,
    alignItems: 'center',
  },
  residentLogoWrap: {},
  residentLogo: {
    width: 148,
    height: 64,
  },
  communityWordmark: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    maxWidth: 220,
  },
  poweredBy: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logo: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 16,
    color: Colors.navy,
  },
  welcomeTag: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: Colors.cyan,
    letterSpacing: 2,
    marginBottom: 8,
  },
  greeting: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.pageTitle,
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 8,
  },
  subCopy: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: 'rgba(45,224,255,0.75)',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 44×44px touch zone — spec requirement
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 18,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(45,224,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(45,224,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 10,
    color: Colors.cyan,
  },
  adminBase: {
    paddingBottom: 24,
  },
  iconBtnRelative: {
    position: 'relative',
  },
  msgBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Colors.negative,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBadgeText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  adminEyebrow: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: Colors.cyan,
    letterSpacing: 2,
    marginBottom: 6,
  },
  adminIdentity: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
