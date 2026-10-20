import type { TextStyle } from 'react-native';

/**
 * Dark theme, evolved from the existing AppSheet app: warm off-black surfaces
 * (one warm grey family throughout) and a softened salmon accent for today,
 * the active tab and primary actions.
 */
export const colors = {
  background: '#151312',
  surface: '#1F1C1A',
  surfaceRaised: '#2A2624',
  text: '#F4EFEB',
  textSecondary: '#A39890',
  textTertiary: '#6E655F',
  border: '#332E2B',
  accent: '#EC958C',
  accentMuted: '#3A2522',
  /** Text/icons on the accent; dark, since white on salmon is too faint. */
  onAccent: '#2B1411',
  /** Text on the service colours in calendars. */
  onService: '#FFFFFF',
  success: '#8CC9A0',
  whatsapp: '#25D366',
  danger: '#F2766E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

/** Shared text styles. Times use tabular figures so columns line up. */
export const type = {
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  time: { fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** Pressed feedback for buttons and rows: a slight press-in. */
export const pressedStyle = { opacity: 0.85, transform: [{ scale: 0.98 }] };

/** Service colour at low opacity, for tinted calendar blocks. */
export function tint(hex: string, alpha = 0.22): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
