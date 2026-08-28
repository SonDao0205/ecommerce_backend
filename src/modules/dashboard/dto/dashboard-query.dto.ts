import { IsDateString, IsEnum, IsOptional, ValidateIf } from 'class-validator';

export enum DashboardRange {
  TODAY = 'today',
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  THIS_MONTH = 'month',
  CUSTOM = 'custom',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardRange, { message: 'Khoảng thời gian không hợp lệ' })
  range: DashboardRange = DashboardRange.SEVEN_DAYS;

  @ValidateIf((dto: DashboardQueryDto) => dto.range === DashboardRange.CUSTOM)
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ValidateIf((dto: DashboardQueryDto) => dto.range === DashboardRange.CUSTOM)
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;
}
