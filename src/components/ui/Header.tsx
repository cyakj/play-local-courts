import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ArrowLeft, Menu } from 'lucide-react-native';

import { Colors, FontFamily, FontSize } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

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
  onMenu?: () => void;
}

interface CoachHeaderProps {
  variant: 'coach';
  onBell?: () => void;
  onSettings?: () => void;
}

type HeaderProps =
  | CMPortfolioHeaderProps
  | ResidentHomeHeaderProps
  | InnerScreenHeaderProps
  | ResidentHeaderProps
  | CoachHeaderProps;

export function Header(props: HeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 24);
  const { theme } = useTheme();

  if (props.variant === 'resident' || props.variant === 'coach') {
    const isCoach = props.variant === 'coach';
    return (
      <View style={[styles.base, styles.residentBase, { paddingTop: topPad + 8, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={[styles.topBar, styles.residentTopBar]}>
          <View testID="tenisx-logo" style={styles.residentLogoWrap}>
            <Image
              source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
              style={styles.residentLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              testID="bell-icon"
              style={styles.iconBtn}
              onPress={props.onBell ?? (() => router.push('/notifications'))}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Bell color="#FFFFFF" size={24} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="menu-icon"
              style={styles.iconBtn}
              onPress={
                isCoach
                  ? ((props as CoachHeaderProps).onSettings ?? (() => router.push('/(coach)/me' as any)))
                  : ((props as ResidentHeaderProps).onMenu ?? (() => router.push('/settings')))
              }
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Menu color="#FFFFFF" size={24} strokeWidth={1.5} />
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
    paddingLeft: 0,
    paddingRight: 14,
    paddingBottom: 10,
    minHeight: 80,
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
    width: 160,
    height: 72,
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
});
