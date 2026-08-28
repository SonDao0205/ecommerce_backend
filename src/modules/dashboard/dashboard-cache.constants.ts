export const DASHBOARD_CACHE_VERSION_KEY = 'dashboard:cache-version';

export const dashboardCacheKey = (
  version: number,
  range: string,
  from?: string,
  to?: string,
) => `dashboard:v1:${version}:${range}:${from ?? ''}:${to ?? ''}`;
