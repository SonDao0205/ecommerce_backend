import { BadRequestException, Injectable } from '@nestjs/common';
import { DashboardQueryDto, DashboardRange } from './dto/dashboard-query.dto';
import {
  DashboardPeriod,
  DashboardRepository,
  DashboardSeriesPoint,
  MetricSnapshot,
} from './dashboard.repository';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';
import {
  DASHBOARD_CACHE_VERSION_KEY,
  dashboardCacheKey,
} from './dashboard-cache.constants';

export interface DashboardMetric {
  value: number;
  previousValue: number;
  changePercent: number;
}

export interface DashboardView {
  period: {
    range: DashboardRange;
    start: Date;
    end: Date;
    previousStart: Date;
    previousEnd: Date;
    bucket: DashboardPeriod['bucket'];
  };
  metrics: {
    revenue: DashboardMetric;
    completedOrders: DashboardMetric;
    soldProducts: DashboardMetric;
    newCustomers: DashboardMetric;
    averageOrderValue: DashboardMetric;
    cancellationRate: DashboardMetric;
  };
  series: DashboardSeriesPoint[];
  orderStatuses: Awaited<ReturnType<DashboardRepository['getOrderStatuses']>>;
  topProducts: Awaited<ReturnType<DashboardRepository['getTopProducts']>>;
  lowStock: Awaited<ReturnType<DashboardRepository['getLowStock']>>;
  customers: {
    segments: Awaited<ReturnType<DashboardRepository['getCustomerSegments']>>;
    top: Awaited<ReturnType<DashboardRepository['getTopCustomers']>>;
  };
  actions: {
    pendingOrders: number;
    pendingRefunds: number;
    lowStockItems: number;
    unansweredReviews: number;
  };
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly cache: RedisCacheService,
    private readonly configService: ConfigService,
  ) {}

  async getDashboard(query: DashboardQueryDto): Promise<DashboardView> {
    const version = await this.cache.getNumber(DASHBOARD_CACHE_VERSION_KEY);
    const ttl = Number(
      this.configService.get<string>('DASHBOARD_CACHE_TTL_SECONDS', '30'),
    );
    return this.cache.rememberJson(
      dashboardCacheKey(version, query.range, query.from, query.to),
      ttl,
      () => this.loadDashboard(query),
    );
  }

  private async loadDashboard(
    query: DashboardQueryDto,
  ): Promise<DashboardView> {
    const period = this.resolvePeriod(query);
    const [
      current,
      previous,
      series,
      orderStatuses,
      topProducts,
      lowStock,
      segments,
      topCustomers,
      pendingRefunds,
      unansweredReviews,
      pendingOrders,
    ] = await Promise.all([
      this.repository.getMetricSnapshot(period.start, period.end),
      this.repository.getMetricSnapshot(
        period.previousStart,
        period.previousEnd,
      ),
      this.repository.getSeries(period),
      this.repository.getOrderStatuses(period.start, period.end),
      this.repository.getTopProducts(period.start, period.end),
      this.repository.getLowStock(),
      this.repository.getCustomerSegments(period.start, period.end),
      this.repository.getTopCustomers(period.start, period.end),
      this.repository.countPendingRefunds(),
      this.repository.countUnansweredReviews(),
      this.repository.countPendingOrders(),
    ]);

    return {
      period: { range: query.range, ...period },
      metrics: this.buildMetrics(current, previous),
      series,
      orderStatuses,
      topProducts,
      lowStock,
      customers: { segments, top: topCustomers },
      actions: {
        pendingOrders,
        pendingRefunds,
        lowStockItems: lowStock[0]?.totalCount ?? 0,
        unansweredReviews,
      },
    };
  }

  resolvePeriod(query: DashboardQueryDto, now = new Date()): DashboardPeriod {
    const todayStart = this.startOfVietnamDay(now);
    let start: Date;
    let end = now;

    switch (query.range) {
      case DashboardRange.TODAY:
        start = todayStart;
        break;
      case DashboardRange.THIRTY_DAYS:
        start = new Date(todayStart.getTime() - 29 * DAY_MS);
        break;
      case DashboardRange.THIS_MONTH: {
        const shifted = new Date(now.getTime() + VN_OFFSET_MS);
        start = new Date(
          Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) -
            VN_OFFSET_MS,
        );
        break;
      }
      case DashboardRange.CUSTOM:
        if (!query.from || !query.to) {
          throw new BadRequestException(
            'Khoảng tùy chỉnh cần ngày bắt đầu và kết thúc',
          );
        }
        start = this.parseVietnamDate(query.from);
        end = new Date(this.parseVietnamDate(query.to).getTime() + DAY_MS);
        if (end <= start) {
          throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
        }
        if (end.getTime() - start.getTime() > 366 * DAY_MS) {
          throw new BadRequestException('Chỉ được thống kê tối đa 366 ngày');
        }
        break;
      case DashboardRange.SEVEN_DAYS:
      default:
        start = new Date(todayStart.getTime() - 6 * DAY_MS);
        break;
    }

    const duration = end.getTime() - start.getTime();
    const bucket: DashboardPeriod['bucket'] =
      duration <= 2 * DAY_MS ? 'hour' : duration > 90 * DAY_MS ? 'week' : 'day';
    return {
      start,
      end,
      previousStart: new Date(start.getTime() - duration),
      previousEnd: start,
      bucket,
    };
  }

  private buildMetrics(
    current: MetricSnapshot,
    previous: MetricSnapshot,
  ): DashboardView['metrics'] {
    const currentAverage = current.completedOrders
      ? current.revenue / current.completedOrders
      : 0;
    const previousAverage = previous.completedOrders
      ? previous.revenue / previous.completedOrders
      : 0;
    const currentCancellation = current.totalOrders
      ? (current.cancelledOrders / current.totalOrders) * 100
      : 0;
    const previousCancellation = previous.totalOrders
      ? (previous.cancelledOrders / previous.totalOrders) * 100
      : 0;
    return {
      revenue: this.metric(current.revenue, previous.revenue),
      completedOrders: this.metric(
        current.completedOrders,
        previous.completedOrders,
      ),
      soldProducts: this.metric(current.soldProducts, previous.soldProducts),
      newCustomers: this.metric(current.newCustomers, previous.newCustomers),
      averageOrderValue: this.metric(currentAverage, previousAverage),
      cancellationRate: this.metric(currentCancellation, previousCancellation),
    };
  }

  private metric(value: number, previousValue: number): DashboardMetric {
    const changePercent =
      previousValue === 0
        ? value === 0
          ? 0
          : 100
        : ((value - previousValue) / Math.abs(previousValue)) * 100;
    return {
      value: this.round(value),
      previousValue: this.round(previousValue),
      changePercent: this.round(changePercent),
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private startOfVietnamDay(date: Date): Date {
    const shifted = new Date(date.getTime() + VN_OFFSET_MS);
    return new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
      ) - VN_OFFSET_MS,
    );
  }

  private parseVietnamDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) throw new BadRequestException('Ngày không hợp lệ');
    const [, year, month, day] = match;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)) - VN_OFFSET_MS,
    );
    const shifted = new Date(date.getTime() + VN_OFFSET_MS);
    if (
      shifted.getUTCFullYear() !== Number(year) ||
      shifted.getUTCMonth() !== Number(month) - 1 ||
      shifted.getUTCDate() !== Number(day)
    ) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    return date;
  }
}
