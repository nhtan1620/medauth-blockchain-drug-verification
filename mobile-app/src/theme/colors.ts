/**
 * Design tokens for MedAuth. Accessibility requirements from the project
 * doc (14.4): contrast > 4.5:1, 16–20pt type, 48px+ touch targets, and
 * never signal outcome via colour alone (always pair with icon + text).
 */
export const colors = {
  background: '#F7FAF9',
  surface: '#FFFFFF',
  primary: '#0B5D4C', // WISSEN/MedAuth brand green
  primaryDark: '#063D32',
  textPrimary: '#12201C',
  textSecondary: '#5B6B66',
  border: '#E1E8E5',

  authentic: '#1E8E5A', // Green
  authenticBg: '#E7F6EE',
  counterfeit: '#C62828', // Red
  counterfeitBg: '#FDECEC',
  notFound: '#B8860B', // Yellow/amber
  notFoundBg: '#FFF7E0',

  offline: '#8A6D00',
  offlineBg: '#FFF3CC',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
  button: { fontSize: 18, fontWeight: '600' as const },
};

export const touchTarget = { minHeight: 48, minWidth: 48 };
