import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { Colors, FontFamily } from '@/constants/design';
import { bundledLogoFor } from '@/config/communityBranding';

// Both logos are drawn straight onto the header — no container, border, badge or
// tint — and keep their native aspect ratio. Artwork is never recolored.

const TENISX_LOGO = require('@/assets/branding/tenisx-logo.png');
const TENISX_ASPECT = 628 / 253; // intrinsic size of assets/branding/tenisx-logo.png

export function TenisXLogo({ height = 28, testID }: { height?: number; testID?: string }) {
  return (
    <Image
      testID={testID}
      source={TENISX_LOGO}
      accessibilityRole="image"
      accessibilityLabel="TenisX"
      resizeMode="contain"
      style={{ height, width: height * TENISX_ASPECT }}
    />
  );
}

interface CommunityLogoProps {
  hoaId?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  height?: number;
  /** Upper bound for the logo width so a very wide wordmark never crowds the header. */
  maxWidth?: number;
  testID?: string;
}

function useAspect(source: ImageSourcePropType | null): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  const uri = source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source ? source.uri : null;

  useEffect(() => {
    setAspect(null);
    if (!source) return;
    if (uri) {
      let cancelled = false;
      Image.getSize(
        uri,
        (w, h) => { if (!cancelled && w && h) setAspect(w / h); },
        () => { /* handled by the Image onError fallback */ },
      );
      return () => { cancelled = true; };
    }
    const resolved = Image.resolveAssetSource(source);
    if (resolved?.width && resolved?.height) setAspect(resolved.width / resolved.height);
  }, [source, uri]);

  return aspect;
}

/**
 * The active community's identity: its uploaded logo (`logoUrl`), else a logo bundled
 * for that community id, else its name as text. Missing, loading and broken logos all
 * degrade to the name — never to another community's artwork.
 */
export function CommunityLogo({ hoaId, name, logoUrl, height = 34, maxWidth = 220, testID }: CommunityLogoProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);

  // Memoised: a fresh source object each render would retrigger the aspect lookup.
  const source = useMemo<ImageSourcePropType | null>(
    () => (logoUrl && logoUrl !== failedUri ? { uri: logoUrl } : bundledLogoFor(hoaId)),
    [logoUrl, failedUri, hoaId],
  );
  const aspect = useAspect(source);

  if (source && aspect) {
    const width = Math.min(maxWidth, height * aspect);
    return (
      <Image
        testID={testID}
        source={source}
        accessibilityRole="image"
        accessibilityLabel={name ?? 'Community logo'}
        resizeMode="contain"
        onError={() => { if (logoUrl) setFailedUri(logoUrl); }}
        style={{ height: width / aspect, width }}
      />
    );
  }

  // Loading the logo, or none exists: keep the row height stable and show the name.
  return (
    <View testID={testID} style={[styles.textWrap, { minHeight: height }]}>
      {name ? (
        <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  textWrap: { justifyContent: 'center' },
  name: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 20,
    color: Colors.white,
    letterSpacing: -0.3,
  },
});
