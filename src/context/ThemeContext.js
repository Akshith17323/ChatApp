import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, isThemeMode, lightColors, resolveColorScheme } from '../theme/colors';

const STORAGE_KEY = '@chat-app/appearance';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setMode] = useState('system');
  const [storageError, setStorageError] = useState(null);
  const hasChosenMode = useRef(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedMode) => {
        if (mounted && !hasChosenMode.current && isThemeMode(savedMode)) {
          setMode(savedMode);
        }
      })
      .catch(() => {
        if (mounted) setStorageError('Could not load your saved appearance.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode) => {
    if (!isThemeMode(mode)) return;
    hasChosenMode.current = true;
    setMode(mode);
    setStorageError(null);
    // Serialize writes so rapid changes cannot save an older selection last.
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, mode))
      .catch(() => setStorageError('Appearance changed, but could not be saved on this device.'));
  }, []);

  useEffect(() => {
    // React Native Web does not implement the native appearance override.
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(themeMode === 'system' ? 'auto' : themeMode);
    }
  }, [themeMode]);

  const isDark = resolveColorScheme(themeMode, systemScheme) === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const value = useMemo(
    () => ({ colors, isDark, themeMode, setThemeMode, storageError }),
    [colors, isDark, themeMode, setThemeMode, storageError]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useAppTheme must be used within ThemeProvider');
  return theme;
}

export function useThemedStyles(createStyles) {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
