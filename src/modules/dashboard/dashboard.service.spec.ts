import { BadRequestException } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
import { DashboardRange } from './dto/dashboard-query.dto';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';

describe('DashboardService', () => {
  const service = new DashboardService(
    {} as DashboardRepository,
    {} as RedisCacheService,
    {} as ConfigService,
  );
  const now = new Date('2026-08-28T03:30:00.000Z'); // 10:30 tại Việt Nam

  it('resolves today from Vietnam midnight and compares the same elapsed time', () => {
    const period = service.resolvePeriod({ range: DashboardRange.TODAY }, now);
    expect(period.start.toISOString()).toBe('2026-08-27T17:00:00.000Z');
    expect(period.end).toEqual(now);
    expect(period.previousEnd).toEqual(period.start);
    expect(period.end.getTime() - period.start.getTime()).toBe(
      period.previousEnd.getTime() - period.previousStart.getTime(),
    );
    expect(period.bucket).toBe('hour');
  });

  it('resolves this month in the configured Vietnam timezone', () => {
    const period = service.resolvePeriod(
      { range: DashboardRange.THIS_MONTH },
      now,
    );
    expect(period.start.toISOString()).toBe('2026-07-31T17:00:00.000Z');
    expect(period.bucket).toBe('day');
  });

  it('uses inclusive calendar dates for a custom range', () => {
    const period = service.resolvePeriod(
      {
        range: DashboardRange.CUSTOM,
        from: '2026-08-01',
        to: '2026-08-07',
      },
      now,
    );
    expect(period.start.toISOString()).toBe('2026-07-31T17:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-08-07T17:00:00.000Z');
  });

  it('rejects an inverted custom range', () => {
    expect(() =>
      service.resolvePeriod(
        {
          range: DashboardRange.CUSTOM,
          from: '2026-08-10',
          to: '2026-08-01',
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });
});
