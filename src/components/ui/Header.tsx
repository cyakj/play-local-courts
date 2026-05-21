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
          <TouchableOpacity
            onPress={props.onBack}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft color="#FFFFFF" size={22} strokeWidth={1.5} />
          </TouchableOpacity>
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          {isCM && (
            <TouchableOpacity
              onPress={(props as CMPortfolioHeaderProps).onMenu}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
    backgroundColor: Colors.headerBg,
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
