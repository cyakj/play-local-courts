import React, { createContext, useContext, useState, useCallback } from 'react';

export type AppMode = 'hoa' | 'tennis';

/**
 * isTennisEnabled — master feature flag for global TennisX features.
 *
 * Set this to `true` when TennisX (ladders, partner finding, coaching,
 * global court reservations) is ready to ship.  While `false`:
 *   - Tennis routes redirect to HOA home + show Coming Soon modal
 *   - Tennis UI sections are hidden across Profile, Dashboard, Settings, etc.
 *   - HOA amenity tennis court reservations are UNAFFECTED (those are HOA features)
 */
export const isTennisEnabled = false;

interface ModeContextType {
  mode: AppMode;
  /** true when isTennisEnabled is false — use to gate tennis UI */
  isHOAMode: boolean;
  showTennisComingSoon: boolean;
  triggerTennisComingSoon: () => void;
  closeTennisComingSoon: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  // Always 'hoa' while isTennisEnabled = false
  const [mode] = useState<AppMode>('hoa');
  const [showTennisComingSoon, setShowTennisComingSoon] = useState(false);

  const triggerTennisComingSoon = useCallback(() => {
    setShowTennisComingSoon(true);
  }, []);

  const closeTennisComingSoon = useCallback(() => {
    setShowTennisComingSoon(false);
  }, []);

  return (
    <ModeContext.Provider
      value={{
        mode,
        isHOAMode: !isTennisEnabled,
        showTennisComingSoon,
        triggerTennisComingSoon,
        closeTennisComingSoon,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
