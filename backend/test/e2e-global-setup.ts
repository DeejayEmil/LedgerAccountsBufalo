import { rmSync } from 'fs';
import EmbeddedPostgres from 'embedded-postgres';
import {
  state,
  E2E_PG_PORT,
  E2E_PG_DATABASE_DIR,
  E2E_DB_NAME,
  E2E_DB_USER,
  E2E_DB_PASSWORD,
} from './e2e-pg-instance';

/**
 * Levanta un Postgres embebido (sin Docker, sin permisos de root) antes de
 * correr los tests e2e, para que `npm run test:e2e` sea 100% reproducible
 * en cualquier máquina. La app "real" en desarrollo sigue usando el
 * Postgres de docker-compose; esto es exclusivamente para la suite de
 * integración.
 */
export default async function globalSetup(): Promise<void> {
  // Idempotente: si una corrida anterior no se cerró limpio (ej. proceso
  // matado a la fuerza), initdb falla si el directorio ya existe.
  rmSync(E2E_PG_DATABASE_DIR, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: E2E_PG_DATABASE_DIR,
    port: E2E_PG_PORT,
    user: E2E_DB_USER,
    password: E2E_DB_PASSWORD,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(E2E_DB_NAME);

  state.pg = pg;

  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = String(E2E_PG_PORT);
  process.env.DB_USERNAME = E2E_DB_USER;
  process.env.DB_PASSWORD = E2E_DB_PASSWORD;
  process.env.DB_NAME = E2E_DB_NAME;
  // Puerto de Redis deliberadamente apuntado a "nadie escuchando": el
  // RedisService está diseñado para degradar a cache-miss si Redis no
  // responde, así que los tests igual deben pasar (ver src/redis/redis.service.ts).
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '1';
  process.env.JWT_SECRET = 'e2e-test-secret';
  process.env.NODE_ENV = 'test';
}
