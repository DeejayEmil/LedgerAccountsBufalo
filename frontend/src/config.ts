// Expo inlina automáticamente cualquier variable de entorno con prefijo
// EXPO_PUBLIC_ en tiempo de build (ver .env.example).
//
// Nota sobre localhost en dispositivos/emuladores:
//   - iOS Simulator: http://localhost:3000 funciona tal cual.
//   - Android Emulator: usar http://10.0.2.2:3000 (localhost del emulador
//     apunta al propio emulador, no a tu máquina).
//   - Dispositivo físico: usar la IP LAN de tu computadora, ej.
//     http://192.168.1.50:3000.
export const API_HTTP_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const GRAPHQL_URL = `${API_HTTP_URL}/graphql`;
