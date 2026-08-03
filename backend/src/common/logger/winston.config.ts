import { utilities as nestWinstonUtils, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

/**
 * Logs estructurados en JSON en producción (para ser consumidos por un
 * agregador tipo CloudWatch/ELK); formato legible en consola durante
 * desarrollo. Nunca se loguean contraseñas, tokens ni datos sensibles de
 * cuentas (ver LoggingInterceptor / filtros de excepción).
 */
export const winstonLogger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              nestWinstonUtils.format.nestLike('QikBanco', {
                colors: true,
                prettyPrint: true,
              }),
            ),
    }),
  ],
});
