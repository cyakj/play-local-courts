import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { darkTheme, lightTheme, ThemeMode, ThemeTokens } from '@/constants/theme-tokens';

const STORAGE_KEY = '@tenisx/theme';

interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeTokens;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  theme: lightTheme,
  setTheme: () => {},
});

export function ThemeProvider({
  children,
  initialMode = 'light',
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const setTheme = useCallback((m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  }, []);

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const value = useMemo(() => ({ mode, theme, setTheme }), [mode, theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

export { STORAGE_KEY };
