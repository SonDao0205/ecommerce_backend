import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@entities';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogStreamService } from './audit-log-stream.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogsController],
  providers: [AuditLogsRepository, AuditLogsService, AuditLogStreamService],
})
export class AuditLogsModule {}
