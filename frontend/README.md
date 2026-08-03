# QikBanco — App móvil (React Native / Expo)

Ver el [README principal del repo](../README.md) para la descripción completa del proyecto, arquitectura y decisiones de diseño.

## Quickstart

```bash
cp .env.example .env   # ajusta EXPO_PUBLIC_API_URL — ver notas abajo
npm install
npm start
```

Escanea el QR con la app Expo Go (Android/iOS), o presiona `i`/`a` en la terminal para abrir un simulador.

## `EXPO_PUBLIC_API_URL`

`localhost` significa cosas distintas según dónde corras la app:

- **iOS Simulator** → `http://localhost:3000` funciona tal cual.
- **Android Emulator** → usa `http://10.0.2.2:3000`.
- **Dispositivo físico (Expo Go)** → usa la IP LAN de tu computadora (ej. `http://192.168.1.50:3000`), obtenida con `ipconfig getifaddr en0` en macOS. El teléfono y la computadora deben estar en la misma red Wi-Fi.

Después de cambiar `.env` hay que reiniciar `npm start` (Ctrl+C y volver a correrlo) — las variables de entorno solo se leen al arrancar el bundler.

## Tests

```bash
npm test        # Jest + Testing Library
npm run typecheck
```
