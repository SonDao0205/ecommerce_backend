import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerAddress, User } from '@entities';
import { Resend } from 'resend';
import { createTransport, Transporter } from 'nodemailer';
import { OrderEmailService } from './order-email.service';
import { GMAIL_TRANSPORTER, RESEND_CLIENT } from './email.constants';

@Module({
  imports: [TypeOrmModule.forFeature([User, CustomerAddress])],
  providers: [
    {
      provide: RESEND_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Resend | null => {
        const apiKey = config.get<string>('RESEND_API_KEY')?.trim();
        return apiKey ? new Resend(apiKey) : null;
      },
    },
    {
      provide: GMAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Transporter | null => {
        const user = config.get<string>('GMAIL_USER')?.trim();
        const appPassword = config
          .get<string>('GMAIL_APP_PASSWORD')
          ?.replace(/\s/g, '');
        if (!user || !appPassword) return null;
        return createTransport({
          service: 'gmail',
          auth: { user, pass: appPassword },
        });
      },
    },
    OrderEmailService,
  ],
  exports: [OrderEmailService],
})
export class EmailModule {}
