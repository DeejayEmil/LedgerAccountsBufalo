// Tema mínimo y centralizado. No se evalúa diseño en esta prueba, pero
// centralizar colores/espaciado evita "magic numbers" repetidos y hace
// la UI consistente con poco esfuerzo.
export const colors = {
  primary: '#0F62FE',
  onPrimary: '#FFFFFF',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#1A1D21',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  success: '#16A34A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  subtitle: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  money: { fontSize: 32, fontWeight: '700' as const },
};
