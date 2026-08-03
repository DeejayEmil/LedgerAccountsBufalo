# QikBanco — Accounts & Ledger Service

Prueba técnica full-stack: servicio de cuentas y libro mayor (ledger) para Qik banco digital, con extras (transferencias entre usuarios, historial de balance, foto de perfil, comprobantes por correo).

Stack: **NestJS + GraphQL + TypeORM + PostgreSQL + Redis** (backend) y **React Native (Expo) + TypeScript** (frontend).

## Estructura y branches

```
├── main/ # Readme general del proyecto y link de video demostrativo
├── backend/     # API NestJS (REST para auth, GraphQL para el dominio)
└── frontend/    # App React Native (Expo)
```

## Funcionalidad implementada

- **Cuentas**: crear cuenta, listar cuentas del usuario, detalle de cuenta, consultar balance.
- **Ledger**: registrar transacción de crédito/débito de forma atómica, con validación de saldo suficiente para débitos.
- **Transferencias entre usuarios**: enviar dinero a la cuenta de *cualquier* usuario por número de cuenta (no solo entre tus propias cuentas), atómica y con locks ordenados para evitar deadlocks.
- **Movimientos**: listar transacciones de una cuenta con filtros por fecha y tipo, y paginación.
- **Resumen de balance**: balance actual, total de créditos, total de débitos, cantidad de movimientos (cacheado en Redis).
- **Historial de balance**: balance de cierre por día de los últimos N días, mostrado como gráfico de barras simple en la app.
- **Foto de perfil**: selector de imagen desde la galería del teléfono, guardada como avatar del usuario.
- **Comprobantes por correo**: al completar cualquier movimiento (depósito, retiro o transferencia) se envía un correo con el detalle a la cuenta del usuario — y, en transferencias, también al que recibe.
- **Mensajes de éxito**: confirmación en pantalla con los detalles del movimiento al completarse.
- **Auth**: registro/login con JWT (bcrypt para contraseñas).

No implementado: infraestructura de despliegue, CI/CD, diseño UI pulido.

## Requisitos

- Node.js, React Native
- Docker (para levantar PostgreSQL y Redis del backend)
- Para correr la app móvil: Expo Go en tu teléfono, o un simulador iOS/Android

## 1. Backend

```bash
cd backend
cp .env.example .env
docker compose up -d        # levanta Postgres + Redis
npm install
npm run start:dev
```

La API queda en `http://localhost:3000`:
- GraphQL Playground: `http://localhost:3000/graphql` (mutations/queries de cuentas, transacciones, transferencias, balance)
- Swagger (auth REST): `http://localhost:3000/api/docs`
- Health check: `http://localhost:3000/health`

En el primer arranque, TypeORM crea el esquema automáticamente (`synchronize` activo fuera de producción — ver nota en `src/config/typeorm.config.ts`).

### Correo de confirmación (opcional)

Por defecto, los correos se loguean en la consola del backend en vez de enviarse de verdad (no rompe nada, solo no llegan a la bandeja de entrada). Para que se envíen de verdad, edita `backend/.env` con credenciales SMTP reales — ver comentarios en `.env.example` para instrucciones de Gmail (contraseña de aplicación) o Resend (API key gratis).

### Problema común: "role qikbanco does not exist"

Si el backend no logra conectar y ves este error en un loop de reintentos, casi siempre es porque **ya tienes un Postgres nativo corriendo en tu máquina** (instalado con Homebrew — `brew services list` — o con Postgres.app) escuchando en el mismo puerto 5432 que el contenedor de Docker. En macOS, `localhost` resuelve primero a `::1` (IPv6), y un Postgres nativo bindeado específicamente ahí gana prioridad sobre el proxy de Docker aunque el contenedor esté sano.

Diagnóstico:

```bash
lsof -i :5432          # lista qué proceso(s) están usando el puerto
brew services list      # si aparece "postgresql@X" como started, ahí está
```

Solución: detén el Postgres nativo (no el de Docker) y vuelve a intentar.

```bash
brew services stop postgresql@15   # usa el nombre exacto que te haya salido
npm run start:dev
```

### Tests del backend

```bash
npm test          # 30 tests unitarios (reglas de negocio, mocks — no requieren Postgres)
npm run test:e2e  # 13 tests de integración end-to-end vía HTTP real
```

`test:e2e` levanta automáticamente un Postgres embebido (sin Docker, sin permisos de root) solo para la duración de la suite — no toca la base de datos de desarrollo. Es completamente reproducible: no requiere que `docker compose up` esté corriendo para pasar los tests.

## 2. Frontend (React Native / Expo)

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

Escanea el QR con Expo Go, o presiona `i`/`a` para simulador iOS/Android.

**Importante sobre `EXPO_PUBLIC_API_URL`** (en `.env`): `localhost` significa cosas distintas según dónde corras la app:
- iOS Simulator → `http://localhost:3000` funciona tal cual.
- Android Emulator → usa `http://10.0.2.2:3000` (el emulador tiene su propio "localhost").
- Dispositivo físico → usa la IP LAN de tu computadora, ej. `http://192.168.1.50:3000` (debe estar en la misma red Wi-Fi).

**Foto de perfil**: al tocar tu avatar en la pantalla de cuentas, la app pide permiso para acceder a tus fotos. Si lo rechazas, puedes habilitarlo después desde Ajustes del teléfono → QikBanco → Fotos.

### Tests del frontend

```bash
npm test          # 9 tests: utilidades + componentes (Jest + Testing Library)
npm run typecheck
```

## Arquitectura y decisiones de diseño

**Backend — capas.** `domain` (entidades TypeORM) → `application` implícita en los `*.service.ts` (casos de uso) → `infrastructure` (Redis, email, config) → `interfaces` vía resolvers GraphQL y un controller REST para auth. Se mantuvo deliberadamente sin las capas explícitas de Clean Architecture "de libro" (interfaces de repositorio separadas de su implementación, etc.) porque el mandato pide simplicidad y el dominio es pequeño; TypeORM ya actúa como capa de repositorio razonable para este alcance.

**Por qué REST para auth y GraphQL para el dominio.** El stack pide ambos ("GraphQL, Swagger" en la lista de tecnologías) y los criterios de evaluación piden explícitamente "patrones GraphQL consistentes". Login/registro vía REST es un patrón común incluso en apps GraphQL (más simple de testear con Supertest, y evita mezclar autenticación con el schema de dominio).

**Dinero como string, no Float.** Todos los montos (`balance`, `amount`, `balanceAfter`) se manejan como `numeric` en Postgres y `string` en la API/GraphQL, nunca `Float`. Los cálculos del ledger se hacen en centavos (`bigint`) para evitar errores de precisión de punto flotante — inaceptable en un sistema financiero real.

**Atomicidad e integridad de datos.** `LedgerService.createTransaction` y `LedgerService.transferToAccount` usan locks pesimistas (`SELECT ... FOR UPDATE`) dentro de una transacción de base de datos para serializar escrituras concurrentes sobre el balance de una cuenta. Para transferencias entre dos cuentas, ambas se bloquean siempre en el mismo orden determinístico (por id) sin importar cuál es origen y cuál destino, para evitar deadlocks cuando dos transferencias corren en direcciones opuestas al mismo tiempo. La actualización de balances y la inserción de los movimientos del ledger ocurren en la misma transacción: todo se aplica junto, o nada.

**Redis.** Se usa como cache de lectura (cache-aside) para el resumen de balance (`balanceSummary`), invalidado en cada nueva transacción sobre esa cuenta (en transferencias, se invalida en ambas cuentas). Diseñado para degradar sin caer: si Redis no responde, `RedisService` trata el error como cache-miss y la API sigue funcionando (solo pierde el beneficio de performance).

**Correo como best-effort.** `EmailService` sigue el mismo patrón que Redis: si no hay credenciales SMTP configuradas o el envío falla, se loguea una advertencia pero la transacción ya confirmada en base de datos no se revierte ni falla la respuesta al cliente. Un correo de notificación nunca debe poder tumbar una operación bancaria real.

**Foto de perfil como data URI.** El avatar se guarda como base64 directamente en la fila del usuario (columna `text`), no en un bucket de object storage. Es una simplificación deliberada para esta prueba — en un sistema real esto viviría en S3/GCS y la base de datos solo guardaría la URL pública.

**Postgres embebido para e2e.** Se usa el paquete `embedded-postgres` en `test/e2e-global-setup.ts` para que la suite de integración sea reproducible sin depender de Docker ni de una base de datos ya levantada — relevante para el criterio de evaluación "Entrega en tiempo, documentación y reproducibilidad".

**`moduleResolution: "node"` en vez de `"nodenext"`.** El scaffold inicial de Nest CLI generó el tsconfig con resolución `nodenext`, que resultó incompatible con los tipos internos de una de las dependencias (`class-validator`). Se cambió a la resolución `"node"` clásica — la que usa la gran mayoría de proyectos NestJS en producción — sin ningún cambio de comportamiento en tiempo de ejecución.

## Alternativas consideradas

- **Prisma vs. TypeORM**: se usó TypeORM porque es lo que pide explícitamente el stack del mandato.
- **REST vs. GraphQL puro**: se consideró exponer todo (incluyendo auth) vía GraphQL, pero se descartó por simplicidad de testing y porque mezclar JWT issuance con el resolver graph añadía complejidad sin beneficio claro para este alcance.
- **Nodemailer con SMTP genérico vs. SDK de un proveedor específico** (Resend, SendGrid): se eligió SMTP genérico porque funciona con cualquier proveedor (Gmail, Resend, Mailgun, etc.) sin atar el código a un SDK particular — el usuario decide qué proveedor usar solo cambiando variables de entorno.
