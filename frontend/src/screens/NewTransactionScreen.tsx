import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@apollo/client/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CREATE_TRANSACTION_MUTATION, TRANSFER_MUTATION } from '../api/graphql/ledger';
import { colors, spacing, typography } from '../components/theme';
import { formatMoney } from '../utils/money';
import { Toast } from '../components/Toast';
import type { AppStackParamList } from '../navigation/types';
import type { Transaction, TransferResult } from '../types/domain';

type Props = NativeStackScreenProps<AppStackParamList, 'NewTransaction'>;

type MovementType = 'CREDIT' | 'DEBIT' | 'TRANSFER';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  CREDIT: 'Depósito (crédito)',
  DEBIT: 'Retiro (débito)',
  TRANSFER: 'Transferir a otra cuenta',
};

const TOAST_DURATION_MS = 1500;

export function NewTransactionScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const [type, setType] = useState<MovementType>('CREDIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refetchQueries = ['Transactions', 'BalanceSummary', 'BalanceHistory', 'Account', 'Accounts'];

  const [createTransaction, { loading: isCreatingTransaction }] = useMutation<{
    createTransaction: Transaction;
  }>(CREATE_TRANSACTION_MUTATION, { refetchQueries, awaitRefetchQueries: true });

  const [transferToAccount, { loading: isTransferring }] = useMutation<{
    transferToAccount: TransferResult;
  }>(TRANSFER_MUTATION, { refetchQueries, awaitRefetchQueries: true });

  const loading = isCreatingTransaction || isTransferring;

  const amountIsValid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const destinationIsValid = type !== 'TRANSFER' || /^\d{10}$/.test(toAccountNumber);
  const canSubmit = amountIsValid && destinationIsValid && !loading && !successMessage;

  const showSuccessThenGoBack = (message: string) => {
    setSuccessMessage(message);
    // El toast dura TOAST_DURATION_MS; esperamos un poco más para que
    // termine de leerse antes de volver a la pantalla anterior.
    setTimeout(() => navigation.goBack(), TOAST_DURATION_MS + 200);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (type === 'TRANSFER') {
        const { data } = await transferToAccount({
          variables: {
            input: {
              fromAccountId: accountId,
              toAccountNumber,
              amount,
              ...(description.trim() ? { description: description.trim() } : {}),
            },
          },
        });
        const result = data?.transferToAccount;
        showSuccessThenGoBack(
          `Enviaste ${formatMoney(amount)} a •••• ${toAccountNumber.slice(-4)}. ` +
            `Nuevo balance: ${formatMoney(result?.sourceTransaction.balanceAfter ?? '0')}`,
        );
      } else {
        const { data } = await createTransaction({
          variables: {
            input: {
              accountId,
              type,
              amount,
              ...(description.trim() ? { description: description.trim() } : {}),
            },
          },
        });
        const transaction = data?.createTransaction;
        const verb = type === 'CREDIT' ? 'Depositaste' : 'Retiraste';
        showSuccessThenGoBack(
          `${verb} ${formatMoney(amount)}. Nuevo balance: ${formatMoney(transaction?.balanceAfter ?? '0')}`,
        );
      }
    } catch (err) {
      // Los errores de negocio (ej. "Saldo insuficiente") llegan como
      // GraphQLError; Apollo los expone en err.message de forma legible.
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento.');
    }
  };

  return (
    <View style={styles.container}>
      <Toast
        message={successMessage ?? ''}
        visible={!!successMessage}
        onHide={() => setSuccessMessage(null)}
        durationMs={TOAST_DURATION_MS}
      />

      <Text style={styles.title}>Registrar movimiento</Text>

      <View style={styles.typeRow}>
        {(['CREDIT', 'DEBIT', 'TRANSFER'] as MovementType[]).map((option) => (
          <Pressable
            key={option}
            style={[styles.typeChip, type === option && styles.typeChipActive]}
            onPress={() => setType(option)}
            testID={`type-${option}`}
          >
            <Text style={[styles.typeChipText, type === option && styles.typeChipTextActive]}>
              {MOVEMENT_LABELS[option]}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === 'TRANSFER' ? (
        <TextInput
          style={styles.input}
          placeholder="Número de cuenta destino (10 dígitos)"
          keyboardType="number-pad"
          maxLength={10}
          value={toAccountNumber}
          onChangeText={setToAccountNumber}
          testID="to-account-input"
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Monto, ej. 150.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        testID="amount-input"
      />
      <TextInput
        style={styles.input}
        placeholder="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        testID="description-input"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="submit-transaction"
      >
        <Text style={styles.submitButtonText}>{loading ? 'Guardando…' : 'Confirmar'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { color: colors.text, fontSize: 12, textAlign: 'center' },
  typeChipTextActive: { color: colors.onPrimary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  errorText: { color: colors.danger, textAlign: 'center' },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  submitButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
});
