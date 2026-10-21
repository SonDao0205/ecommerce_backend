import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const connectLogger = new Logger('PORT');
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const port = process.env.PORT;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // loại bỏ field không khai báo trong DTO
      forbidNonWhitelisted: true, // hoặc báo lỗi 400 luôn
      transform: true, // tự chuyển payload thành instance DTO, ép kiểu
    }),
  );

  app.useGlobalFilters();

  await app
    .listen(port ?? 3000)
    .then(() => {
      connectLogger.log(`Kết nối thành công ở PORT : ${port}`);
    })
    .catch(() => {
      connectLogger.log(`Kết nối thất bại : `);
    });
}
await bootstrap();
