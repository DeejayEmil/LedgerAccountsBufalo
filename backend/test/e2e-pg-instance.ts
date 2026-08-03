import EmbeddedPostgres from 'embedded-postgres';

/**
 * Módulo compartido entre e2e-global-setup.ts y e2e-global-teardown.ts.
 * Jest ejecuta ambos globalSetup/globalTeardown en el mismo proceso Node
 * (no en un worker), así que el módulo cacheado por require() conserva
 * esta referencia entre ambas fases.
 */
export const state: { pg?: EmbeddedPostgres } = {};

export const E2E_PG_PORT = 55432;
export const E2E_PG_DATABASE_DIR = `${__dirname}/.e2e-pgdata`;
export const E2E_DB_NAME = 'qikbanco_ledger_test';
export const E2E_DB_USER = 'qikbanco_test';
export const E2E_DB_PASSWORD = 'qikbanco_test';
