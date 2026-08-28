import { Injectable } from '@nestjs/common';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLogsRepository } from './audit-logs.repository';

@Injectable()
export class AuditLogsService {
  constructor(private readonly repository: AuditLogsRepository) {}

  getRecent(query: AuditLogQueryDto) {
    return this.repository.findRecent(query.limit, query.offset);
  }
}
