import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@apollo/client/react';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ACCOUNTS_QUERY, CREATE_ACCOUNT_MUTATION } from '../api/graphql/accounts';
import { UPDATE_AVATAR_MUTATION } from '../api/graphql/user';
import { Account, UserPublic } from '../types/domain';
import { colors, spacing, typography } from '../components/theme';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { Avatar } from '../components/Avatar';
import { Toast } from '../components/Toast';
import { formatMoney } from '../utils/money';
import { useAuth } from '../auth/AuthContext';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Accounts'>;

export function AccountsScreen({ navigation }: Props) {
  const { user, logout, updateUser } = useAuth();
  const { data, loading, error, refetch, networkStatus } = useQuery<{ accounts: Account[] }>(
    ACCOUNTS_QUERY,
    { notifyOnNetworkStatusChange: true },
  );
  const [createAccount, { loading: isCreating }] = useMutation(CREATE_ACCOUNT_MUTATION, {
    refetchQueries: ['Accounts'],
    variables: { input: {} },
  });
  const [updateAvatar] = useMutation<{ updateAvatar: UserPublic }>(UPDATE_AVATAR_MUTATION);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (message: string) => setSuccessMessage(message);

  const handleChangeAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso necesario',
          'Necesitamos acceso a tus fotos para poder cambiar tu foto de perfil.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled) {
        return;
      }
      if (!result.assets[0]?.base64) {
        Alert.alert(
          'No se pudo leer la imagen',
          'Intenta con otra foto, o revisa que la app tenga permiso de acceso a tus fotos.',
        );
        return;
      }

      const mimeType = result.assets[0].mimeType ?? 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${result.assets[0].base64}`;

      setIsPickingAvatar(true);
      const { data: mutationData } = await updateAvatar({ variables: { avatarUrl: dataUri } });
      if (mutationData?.updateAvatar) {
        await updateUser({ avatarUrl: mutationData.updateAvatar.avatarUrl });
        showSuccess('Foto de perfil actualizada');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AccountsScreen] Error al actualizar avatar:', err);
      Alert.alert(
        'No se pudo actualizar tu foto',
        err instanceof Error ? err.message : 'Intenta de nuevo en un momento.',
      );
    } finally {
      setIsPickingAvatar(false);
    }
  };

  const handleCreateAccount = async () => {
    await createAccount();
    showSuccess('Cuenta creada');
  };

  if (loading && !data) {
    return <LoadingView label="Cargando tus cuentas…" />;
  }

  if (error) {
    return (
      <ErrorView
        message="No pudimos cargar tus cuentas."
        onRetry={() => refetch()}
        secondaryActionLabel="Cerrar sesión"
        onSecondaryAction={() => logout()}
      />
    );
  }

  const accounts = data?.accounts ?? [];

  return (
    <View style={styles.container}>
      <Toast
        message={successMessage ?? ''}
        visible={!!successMessage}
        onHide={() => setSuccessMessage(null)}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View>
            <Pressable
              onPress={handleChangeAvatar}
              disabled={isPickingAvatar}
              testID="avatar-button"
              style={styles.avatarWrapper}
            >
              <Avatar fullName={user?.fullName ?? '?'} avatarUrl={user?.avatarUrl} size={52} />
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeIcon}>✎</Text>
              </View>
            </Pressable>
            <Pressable onPress={handleChangeAvatar} disabled={isPickingAvatar} hitSlop={8}>
              <Text style={styles.changePhotoText}>
                {isPickingAvatar ? 'Subiendo…' : 'Cambiar foto'}
              </Text>
            </Pressable>
          </View>
          <View>
            <Text style={styles.greeting}>Hola, {user?.fullName?.split(' ')[0]}</Text>
            <Text style={styles.subtitle}>Tus cuentas</Text>
          </View>
        </View>
        <Pressable onPress={() => logout()} testID="logout-button">
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={accounts.length === 0 && styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={networkStatus === 4} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          <EmptyView
            title="Todavía no tienes cuentas"
            subtitle="Crea tu primera cuenta para empezar a registrar movimientos."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('AccountDetail', { accountId: item.id })}
            testID={`account-card-${item.id}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardType}>{item.type === 'CHECKING' ? 'Corriente' : 'Ahorros'}</Text>
              <Text style={styles.cardNumber} selectable>
                Nº de cuenta: {item.accountNumber}
              </Text>
              <Text style={styles.cardHint}>Compártelo para recibir transferencias</Text>
            </View>
            <Text style={styles.cardBalance}>{formatMoney(item.balance, item.currency)}</Text>
          </Pressable>
        )}
      />

      <Pressable
        style={[styles.createButton, isCreating && styles.buttonDisabled]}
        onPress={handleCreateAccount}
        disabled={isCreating}
        testID="create-account-button"
      >
        <Text style={styles.createButtonText}>
          {isCreating ? 'Creando cuenta…' : '+ Nueva cuenta'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarWrapper: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeIcon: { color: colors.onPrimary, fontSize: 10 },
  changePhotoText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  greeting: { ...typography.subtitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  logoutText: { color: colors.primary, fontSize: 14 },
  emptyContainer: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardType: { ...typography.body, fontWeight: '600', color: colors.text },
  cardNumber: { ...typography.body, color: colors.text, marginTop: 2, letterSpacing: 0.5 },
  cardHint: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  cardBalance: { ...typography.subtitle, color: colors.text },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  createButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
});
