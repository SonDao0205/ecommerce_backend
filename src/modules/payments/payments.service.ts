import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@entities';
import {
  PaymentProcessingError,
  PaymentsRepository,
} from './payments.repository';
import { SepayService } from './sepay.service';

@Injectable()
export class PaymentsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: PaymentsRepository,
    private readonly sepay: SepayService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const interval = Math.max(
      Number(
        this.config.get<string>('PAYMENT_EXPIRY_SWEEP_INTERVAL_MS', '60000'),
      ),
      10000,
    );
    this.timer = setInterval(() => {
      void this.repository.expireDue(50).catch((error: unknown) => {
        const trace = error instanceof Error ? error.stack : undefined;
        this.logger.error('Không thể xử lý thanh toán hết hạn', trace);
      });
    }, interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async handleSepayIpn(secret: string | undefined, body: unknown) {
    this.sepay.verifyIpnSecret(secret);
    try {
      return await this.repository.processSepayIpn(this.sepay.parseIpn(body));
    } catch (error) {
      if (!(error instanceof PaymentProcessingError)) throw error;
      if (error.code === 'NOT_FOUND')
        throw new NotFoundException(error.message);
      throw new ConflictException(error.message);
    }
  }

  async getMyPayment(userId: string, id: string) {
    const current = await this.repository.findById(id, userId);
    if (!current) throw new NotFoundException('Không tìm thấy thanh toán!');
    if (current.status === PaymentStatus.PENDING && current.expiresAt) {
      return (await this.repository.expireById(id, userId)) ?? current;
    }
    return current;
  }

  async cancelMyPayment(userId: string, id: string) {
    const payment = await this.repository.cancelPending(id, userId);
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán!');
    return payment;
  }
}
