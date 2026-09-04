import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { SepayService } from './sepay.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService, SepayService],
  exports: [PaymentsRepository, SepayService],
})
export class PaymentsModule {}
