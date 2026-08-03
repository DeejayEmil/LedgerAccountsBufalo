import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@apollo/client/react';
import { BALANCE_HISTORY_QUERY } from '../api/graphql/ledger';
import { BalanceHistoryPoint } from '../types/domain';
import { colors, spacing, typography } from './theme';

const MAX_BARS = 14;
const CHART_HEIGHT = 90;

const RANGE_OPTIONS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
] as const;

/**
 * Historial de balance simple: una barra por día con movimientos (últimos
 * `MAX_BARS` puntos dentro del rango elegido), sin depender de una
 * librería de gráficos externa. La altura de cada barra es proporcional
 * al balance en sí (base en 0), no al rango min/max de la ventana — con
 * min/max, un solo punto (o balances muy parecidos entre sí) colapsaba
 * todas las barras a la altura mínima y el gráfico se veía vacío.
 */
export function BalanceHistoryChart({ accountId }: { accountId: string }) {
  const [days, setDays] = useState<number>(30);

  const { data, loading, error, refetch } = useQuery<{
    balanceHistory: BalanceHistoryPoint[];
  }>(BALANCE_HISTORY_QUERY, {
    variables: { accountId, days },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[BalanceHistoryChart] Error al cargar historial:', error);
  }

  const points = (data?.balanceHistory ?? []).slice(-MAX_BARS);
  const values = points.map((p) => Number(p.closingBalance));
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 0.01);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Historial de balance</Text>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((option) => (
            <Pressable
              key={option.days}
              onPress={() => setDays(option.days)}
              style={[styles.rangeChip, days === option.days && styles.rangeChipActive]}
              testID={`balance-history-range-${option.days}`}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  days === option.days && styles.rangeChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && !data ? (
        <Text style={styles.mutedText}>Cargando historial…</Text>
      ) : error ? (
        <Pressable onPress={() => refetch()}>
          <Text style={styles.errorText}>No se pudo cargar el historial. Toca para reintentar.</Text>
        </Pressable>
      ) : points.length === 0 ? (
        <Text style={styles.mutedText}>
          Todavía no hay movimientos en los últimos {days} días.
        </Text>
      ) : (
        <>
          <View style={styles.chartRow}>
            {points.map((point) => {
              const value = Number(point.closingBalance);
              // Base en 0: un balance de $0 no dibuja barra, el máximo del
              // rango llena toda la altura disponible.
              const heightRatio = Math.abs(value) / maxAbs;
              const barHeight = Math.max(3, heightRatio * CHART_HEIGHT);
              return (
                <View key={point.date} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: value < 0 ? colors.danger : colors.primary,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.labelsRow}>
            <Text style={styles.labelText}>{formatShortDate(points[0].date)}</Text>
            <Text style={styles.labelText}>{formatShortDate(points[points.length - 1].date)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  title: { ...typography.caption, color: colors.textMuted },
  rangeRow: { flexDirection: 'row', gap: spacing.xs },
  rangeChip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeChipText: { fontSize: 11, color: colors.text },
  rangeChipTextActive: { color: colors.onPrimary },
  mutedText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  errorText: { ...typography.caption, color: colors.danger, textAlign: 'center', paddingVertical: spacing.md },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 3,
  },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_HEIGHT },
  bar: { width: '100%', backgroundColor: colors.primary, borderRadius: 3, minHeight: 3 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  labelText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
});
