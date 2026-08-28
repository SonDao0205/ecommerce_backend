import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const isProduction = process.env.NODE_ENV === 'production';
  const swaggerEnabled = process.env.ENABLE_SWAGGER === 'true' || !isProduction;

  app.use(
    helmet({
      // Swagger UI uses inline assets in development. Production Swagger is
      // disabled by default, so Helmet can use its strict default CSP there.
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );
  if (process.env.ENABLE_COMPRESSION !== 'false') {
    app.use(compression({ threshold: 1024 }));
  }
  const bodyLimit = process.env.HTTP_BODY_LIMIT ?? '1mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  }
  app.enableShutdownHooks();

  const allowedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 1. Prefix cho toàn bộ API: /api/v1/... (giống server.servlet.context-path trong Spring)
  app.setGlobalPrefix('api/v1');

  // 2. Kích hoạt Validation toàn cục (giống @Valid của Spring Boot)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các field không được khai báo trong DTO
      forbidNonWhitelisted: true, // Báo lỗi 400 nếu client gửi thừa field
      transform: true, // Tự động convert kiểu dữ liệu (vd: string -> number theo DTO)
    }),
  );

  // 3. Cấu hình Swagger / OpenAPI (giống SpringDoc OpenAPI)
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('E-Commerce API')
      .setDescription('Tài liệu API hệ thống E-Commerce')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`🚀 Server đang chạy tại: http://localhost:${port}/api`);
  if (swaggerEnabled) {
    console.log(`📄 Swagger UI: http://localhost:${port}/api/docs`);
  }
}
void bootstrap();
