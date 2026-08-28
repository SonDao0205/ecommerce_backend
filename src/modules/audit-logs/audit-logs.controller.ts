import {
  Controller,
  Get,
  MessageEvent,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRoleEnum } from '@entities';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLogView } from './audit-logs.repository';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogStreamService } from './audit-log-stream.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.WAREHOUSE)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly service: AuditLogsService,
    private readonly streamService: AuditLogStreamService,
  ) {}

  @Get()
  async getRecent(
    @Query() query: AuditLogQueryDto,
  ): Promise<ApiResponseData<AuditLogView[]>> {
    return {
      status: true,
      message: 'Lấy nhật ký hệ thống thành công!',
      data: await this.service.getRecent(query),
      code: 200,
    };
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.streamService.stream();
  }
}
