import { useEffect, useRef } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { onTabEnter } from '@/lib/tabScroll';

/** Attach the returned ref to the tab's main ScrollView: it jumps back to the top whenever the tab is entered. */
export function useScrollToTopOnTabEnter(tabName: string) {
  const ref = useRef<ScrollViewInstance>(null);
  useEffect(() => onTabEnter(tabName, () => ref.current?.scrollTo({ y: 0, animated: false })), [tabName]);
  return ref;
}
