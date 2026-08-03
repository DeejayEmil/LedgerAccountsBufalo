import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { winstonLogger } from './common/logger/winston.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: winstonLogger });

  app.use(helmet());
  app.enableCors();

  // whitelist + forbidNonWhitelisted: cualquier campo no declarado en el
  // DTO es rechazado en vez de ser ignorado silenciosamente (evita que
  // datos inesperados lleguen a la capa de servicio).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QikBanco — Accounts & Ledger Service')
    .setDescription(
      'API REST de autenticación. El dominio (cuentas, transacciones, balance) se expone vía GraphQL en /graphql.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 API escuchando en http://localhost:${port}`);

  console.log(`📘 Swagger (REST auth): http://localhost:${port}/api/docs`);

  console.log(`🎮 GraphQL Playground: http://localhost:${port}/graphql`);
}
bootstrap();
