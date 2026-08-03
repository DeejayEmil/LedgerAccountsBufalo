import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          // No queremos que un Redis caído tumbe la API: los métodos de
          // RedisService están diseñados para degradar sin cache antes que
          // lanzar. maxRetriesPerRequest bajo evita que las requests se
          // queden colgadas esperando reintentos.
          maxRetriesPerRequest: 1,
          lazyConnect: false,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        }),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
