import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/design';

/**
 * Profile avatar: the photo when there is one and it loads, otherwise the person's initials. Never stretches the
 * photo (cover inside a fixed circle) and never shows a broken image.
 */
export function ProfileAvatar({
  photoUrl,
  initials,
  size = 28,
  testID,
  onLoadError,
}: {
  photoUrl?: string | null;
  initials?: string;
  size?: number;
  testID?: string;
  /** Called when the photo fails to load (e.g. an expired signed URL) so the owner can fetch a fresh one. */
  onLoadError?: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  useEffect(() => { setFailedUrl(null); }, [photoUrl]);
  const showPhoto = !!photoUrl && photoUrl !== failedUrl;
  const radius = size / 2;

  return (
    <View
      testID={testID}
      style={[styles.circle, { width: size, height: size, borderRadius: radius }]}
      accessibilityRole="image"
      accessibilityLabel={initials ? `Profile photo, ${initials}` : 'Profile photo'}>
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl! }}
          resizeMode="cover"
          onError={() => { setFailedUrl(photoUrl!); onLoadError?.(); }}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(10, Math.round(size * 0.38)) }]}>{initials || '?'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: 'rgba(45,224,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(45,224,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { fontFamily: FontFamily.manropeBold, color: Colors.cyan },
});
