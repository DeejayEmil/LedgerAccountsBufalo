import { API_HTTP_URL } from '../config';
import { UserPublic } from '../types/domain';

export interface AuthResponse {
  accessToken: string;
  user: UserPublic;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = (data as { message?: unknown }).message;
  // NestJS manda un string para errores "de negocio" (ej. email duplicado)
  // pero un array de strings cuando falla la validación de class-validator
  // (ej. contraseña muy corta) — nos habíamos quedado solo con el caso string.
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
    return message.join('\n');
  }
  return null;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_HTTP_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    // fetch() rechaza (sin llegar a haber respuesta HTTP) cuando el
    // backend no es alcanzable — dirección/puerto equivocado, backend
    // caído, o bloqueo de CORS/red. Ver src/config.ts sobre localhost en
    // emuladores/dispositivos físicos.
    // eslint-disable-next-line no-console
    console.error(`[authApi] No se pudo conectar a ${API_HTTP_URL}${path}:`, networkError);
    throw new ApiError(
      `No se pudo conectar con el servidor (${API_HTTP_URL}). Verifica que el backend esté ` +
        'corriendo y que EXPO_PUBLIC_API_URL en tu .env apunte a la dirección correcta.',
      0,
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractMessage(data) ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const authApi = {
  register(params: { email: string; password: string; fullName: string }) {
    return postJson<AuthResponse>('/auth/register', params);
  },
  login(params: { email: string; password: string }) {
    return postJson<AuthResponse>('/auth/login', params);
  },
};
