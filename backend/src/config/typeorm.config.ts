import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Account } from '../accounts/entities/account.entity';
import { LedgerTransaction } from '../ledger/entities/ledger-transaction.entity';

/**
 * Configuración de TypeORM.
 *
 * `synchronize` está deliberadamente atado a NODE_ENV !== 'production':
 * en desarrollo/pruebas nos permite iterar rápido sobre el esquema sin
 * escribir migraciones a mano; en producción se esperaría usar
 * `typeorm migration:run` en su lugar (fuera de alcance de esta prueba,
 * que explícitamente no evalúa infraestructura/despliegue).
 */
export default registerAs('database', (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'qikbanco',
  password: process.env.DB_PASSWORD || 'qikbanco',
  database: process.env.DB_NAME || 'qikbanco_ledger',
  entities: [User, Account, LedgerTransaction],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
}));
