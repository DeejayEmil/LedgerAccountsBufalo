import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPublic } from '../types/domain';

const ACCESS_TOKEN_KEY = 'qikbanco.accessToken';
const USER_KEY = 'qikbanco.user';

export async function saveSession(accessToken: string, user: UserPublic): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function loadSession(): Promise<{ accessToken: string; user: UserPublic } | null> {
  const [[, accessToken], [, userRaw]] = await AsyncStorage.multiGet([
    ACCESS_TOKEN_KEY,
    USER_KEY,
  ]);

  if (!accessToken || !userRaw) {
    return null;
  }

  return { accessToken, user: JSON.parse(userRaw) as UserPublic };
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, USER_KEY]);
}

/** Actualiza solo los datos de usuario guardados (ej. tras cambiar el avatar), sin tocar el token. */
export async function updateStoredUser(user: UserPublic): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
