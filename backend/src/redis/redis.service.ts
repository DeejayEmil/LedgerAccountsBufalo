import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Wrapper delgado sobre ioredis usado como cache de lectura (cache-aside)
 * para consultas costosas de agregación (resumen de balance). Cualquier
 * error de Redis se loguea y se trata como "cache miss": el caching es una
 * optimización, nunca debe ser una causa de caída de la API.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  onModuleDestroy(): void {
    // Cierra el socket y cancela los reintentos pendientes al apagar la
    // app (importante en tests: si no, Jest queda con handles abiertos).
    // Síncrono: ioredis .disconnect() no devuelve una promesa.
    this.client.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(
        `Cache read falló para key=${key}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Cache write falló para key=${key}: ${(error as Error).message}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Cache invalidation falló para key=${key}: ${(error as Error).message}`,
      );
    }
  }
}
