import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: ReturnType<typeof nodemailer.createTransport> | null =
    null;

  constructor(private readonly configService: ConfigService) {}

  sendPasswordResetOtp = async (email: string, otp: string) => {
    const transporter = this.getTransporter();
    const from = this.configService.get<string>('SMTP_FROM');

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Mã OTP đặt lại mật khẩu',
        text: `Mã OTP đặt lại mật khẩu của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
        html: `<p>Mã OTP đặt lại mật khẩu của bạn là:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>`,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'Không thể gửi email OTP lúc này. Vui lòng thử lại sau.',
      );
    }
  };

  private getTransporter = () => {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT'));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM');

    if (!host || !Number.isInteger(port) || !user || !pass || !from) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình SMTP để gửi email OTP.',
      );
    }

    const secureSetting = this.configService.get<string>('SMTP_SECURE');
    const secure = secureSetting
      ? secureSetting.toLowerCase() === 'true'
      : port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    return this.transporter;
  };
}
