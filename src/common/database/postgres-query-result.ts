/**
 * TypeORM's PostgreSQL QueryRunner returns UPDATE/DELETE results as
 * `[returnedRows, affectedCount]`, while INSERT/SELECT return `rows` directly.
 * Keep that driver-specific detail in one place.
 */
export function extractPostgresRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  if (
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as T[];
  }
  return result as T[];
}
