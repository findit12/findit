import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { UPLOADS_DIR } from './announcements/photo-storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // Photos of the announcements, readable at http://localhost:3000/uploads/<file name>
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });

  // Configurable allowed origins (Point A8)
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global validation pipe using class-validator (Point A1)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter for consistent error formats (Point A3)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger OpenAPI documentation at /api/docs (Point A4)
  const config = new DocumentBuilder()
    .setTitle('FindIt API')
    .setDescription('API documentation for the FindIt lost and found platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

bootstrap();
