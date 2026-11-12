export type ThemeMode = 'system' | 'light' | 'dark';

export const lightColors = {
  background: '#FFFFFF',
  groupedBackground: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceMuted: '#E9E9EB',
  input: '#E3E3E8',
  text: '#171719',
  secondaryText: '#6D6D73',
  placeholder: '#8E8E93',
  border: '#C6C6C8',
  separator: '#E5E5EA',
  primary: '#0066D6',
  primarySoft: '#E5F1FF',
  outgoingBubble: '#0066D6',
  incomingBubble: '#E9E9EB',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.85)',
  danger: '#C92B22',
  dangerSoft: '#FFEBEA',
  success: '#25813B',
  successSoft: '#EAF8EE',
  appIcon: '#34C759',
  shadow: '#000000',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  background: '#000000',
  groupedBackground: '#000000',
  surface: '#1C1C1E',
  surfaceMuted: '#2C2C2E',
  input: '#2C2C2E',
  text: '#F5F5F7',
  secondaryText: '#AEAEB2',
  placeholder: '#98989D',
  border: '#48484A',
  separator: '#38383A',
  primary: '#64A8FF',
  primarySoft: '#132B49',
  outgoingBubble: '#0066D6',
  incomingBubble: '#2C2C2E',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.85)',
  danger: '#FF6961',
  dangerSoft: '#3A1E20',
  success: '#63D77B',
  successSoft: '#153521',
  appIcon: '#34C759',
  shadow: '#000000',
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveColorScheme(
  mode: ThemeMode,
  systemScheme: string | null | undefined
): 'light' | 'dark' {
  return mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
}
