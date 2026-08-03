import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLFormattedError } from 'graphql';
import { join } from 'path';
import typeormConfig from './config/typeorm.config';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { LedgerModule } from './ledger/ledger.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [typeormConfig] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database')!,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Playground/introspección deshabilitados en producción por defecto;
      // en esta prueba técnica se dejan encendidos siempre para que sea
      // fácil de explorar (ver README).
      playground: true,
      introspection: true,
      context: ({ req }: { req: unknown }) => ({ req }),
      formatError: (error: GraphQLFormattedError) => {
        if (process.env.NODE_ENV === 'production') {
          // No filtrar detalles internos (stack traces, SQL, etc.) al cliente.
          const { message, extensions } = error;
          return { message, extensions: { code: extensions?.code } };
        }
        return error;
      },
    }),
    RedisModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    AccountsModule,
    LedgerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
