import { Linking, Platform } from 'react-native';

import { platformAlert } from '@/lib/platformAlert';
import { SUPPORT_EMAIL } from '@/config/support';

/**
 * Opens the mail composer addressed to support. If the device has no mail account/app
 * (or the OS refuses the mailto: URL) the resident is shown the address instead of a
 * dead button, so support is always reachable.
 */
export async function openSupportEmail(subject = 'TenisX Support'): Promise<boolean> {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  try {
    // canOpenURL('mailto:') needs LSApplicationQueriesSchemes on iOS, so a rejected
    // openURL is the reliable signal; web simply navigates.
    if (Platform.OS === 'web') {
      window.location.href = url;
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    platformAlert(
      'No mail app available',
      `We couldn’t open an email composer on this device. You can reach support at ${SUPPORT_EMAIL}.`,
    );
    return false;
  }
}
