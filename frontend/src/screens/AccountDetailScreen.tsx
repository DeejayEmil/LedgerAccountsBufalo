import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@apollo/client/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ACCOUNT_QUERY } from '../api/graphql/accounts';
import { BALANCE_SUMMARY_QUERY, TRANSACTIONS_QUERY } from '../api/graphql/ledger';
import { Account, BalanceSummary, PaginatedTransactions, TransactionType } from '../types/domain';
import { colors, spacing, typography } from '../components/theme';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { BalanceHistoryChart } from '../components/BalanceHistoryChart';
import { formatDate, formatMoney } from '../utils/money';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AccountDetail'>;

const PAGE_SIZE = 10;

type TypeFilter = TransactionType | 'ALL';

export function AccountDetailScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [page, setPage] = useState(1);

  const accountQuery = useQuery<{ account: Account }>(ACCOUNT_QUERY, {
    variables: { id: accountId },
  });

  const summaryQuery = useQuery<{ balanceSummary: BalanceSummary }>(BALANCE_SUMMARY_QUERY, {
    variables: { accountId },
    fetchPolicy: 'cache-and-network',
  });

  const transactionsQuery = useQuery<{ transactions: PaginatedTransactions }>(
    TRANSACTIONS_QUERY,
    {
      variables: {
        filter: {
          accountId,
          page,
          limit: PAGE_SIZE,
          ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
        },
      },
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    },
  );

  if (accountQuery.loading && !accountQuery.data) {
    return <LoadingView label="Cargando cuenta…" />;
  }

  if (accountQuery.error || !accountQuery.data) {
    return (
      <ErrorView
        message="No pudimos cargar esta cuenta."
        onRetry={() => accountQuery.refetch()}
      />
    );
  }

  const account = accountQuery.data.account;
  const summary = summaryQuery.data?.balanceSummary;
  const transactions = transactionsQuery.data?.transactions;

  const handleFilterChange = (next: TypeFilter) => {
    setTypeFilter(next);
    setPage(1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance disponible</Text>
        <Text style={styles.balanceAmount}>{formatMoney(account.balance, account.currency)}</Text>
        <Text style={styles.accountMeta}>
          Cuenta •••• {account.accountNumber.slice(-4)} · {account.currency}
        </Text>

        {summary ? (
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Créditos</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                +{formatMoney(summary.totalCredits, account.currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Débitos</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>
                -{formatMoney(summary.totalDebits, account.currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Movimientos</Text>
              <Text style={styles.summaryValue}>{summary.transactionCount}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <BalanceHistoryChart accountId={accountId} />

      <View style={styles.filterRow}>
        {(['ALL', 'CREDIT', 'DEBIT'] as TypeFilter[]).map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, typeFilter === filter && styles.filterChipActive]}
            onPress={() => handleFilterChange(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                typeFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter === 'ALL' ? 'Todas' : filter === 'CREDIT' ? 'Créditos' : 'Débitos'}
            </Text>
          </Pressable>
        ))}
      </View>

      {transactionsQuery.error ? (
        <ErrorView
          message="No pudimos cargar los movimientos."
          onRetry={() => transactionsQuery.refetch()}
        />
      ) : (
        <FlatList
          data={transactions?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            (transactions?.items.length ?? 0) === 0 && styles.emptyContainer
          }
          ListEmptyComponent={
            transactionsQuery.loading ? (
              <LoadingView label="Cargando movimientos…" />
            ) : (
              <EmptyView title="Sin movimientos" subtitle="Todavía no hay transacciones con este filtro." />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDescription}>
                  {item.description || (item.type === 'CREDIT' ? 'Depósito' : 'Retiro')}
                </Text>
                <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: item.type === 'CREDIT' ? colors.success : colors.danger },
                ]}
              >
                {item.type === 'CREDIT' ? '+' : '-'}
                {formatMoney(item.amount, account.currency)}
              </Text>
            </View>
          )}
          ListFooterComponent={
            transactions && transactions.totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={[styles.pageButton, page <= 1 && styles.buttonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Anterior</Text>
                </Pressable>
                <Text style={styles.pageIndicator}>
                  {transactions.page} / {transactions.totalPages}
                </Text>
                <Pressable
                  disabled={page >= transactions.totalPages}
                  onPress={() => setPage((p) => Math.min(transactions.totalPages, p + 1))}
                  style={[
                    styles.pageButton,
                    page >= transactions.totalPages && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.pageButtonText}>Siguiente</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}

      <Pressable
        style={styles.newTxButton}
        onPress={() => navigation.navigate('NewTransaction', { accountId })}
        testID="new-transaction-button"
      >
        <Text style={styles.newTxButtonText}>+ Registrar movimiento</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceLabel: { color: colors.onPrimary, opacity: 0.85, ...typography.caption },
  balanceAmount: { color: colors.onPrimary, ...typography.money },
  accountMeta: { color: colors.onPrimary, opacity: 0.85, ...typography.caption, marginTop: spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  summaryLabel: { color: colors.onPrimary, opacity: 0.8, ...typography.caption },
  summaryValue: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 13 },
  filterChipTextActive: { color: colors.onPrimary },
  emptyContainer: { flexGrow: 1 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.sm + 4,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txDescription: { ...typography.body, color: colors.text },
  txDate: { ...typography.caption, color: colors.textMuted },
  txAmount: { fontWeight: '700', fontSize: 15 },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pageButton: { padding: spacing.sm },
  pageButtonText: { color: colors.primary, fontWeight: '600' },
  pageIndicator: { color: colors.textMuted },
  buttonDisabled: { opacity: 0.4 },
  newTxButton: {
    backgroundColor: colors.text,
    borderRadius: 8,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  newTxButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
});
