import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('Tài liệu API hệ thống E-Commerce')
    .setVersion('1.0')
    .addBearerAuth() // Thêm nút Authorize JWT trên giao diện Swagger
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`🚀 Server đang chạy tại: http://localhost:${port}/api`);
  console.log(`📄 Swagger UI: http://localhost:${port}/api/docs`);
}
void bootstrap();
