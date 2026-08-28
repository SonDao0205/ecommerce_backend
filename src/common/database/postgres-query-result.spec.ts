import { extractPostgresRows } from './postgres-query-result';

describe('extractPostgresRows', () => {
  it('extracts UPDATE RETURNING rows from the PostgreSQL tuple', () => {
    const row = { id: 'product-id', name: 'Sản phẩm' };
    expect(extractPostgresRows([[row], 1])).toEqual([row]);
  });

  it('keeps INSERT RETURNING rows unchanged', () => {
    const row = { id: 'variant-id' };
    expect(extractPostgresRows([row])).toEqual([row]);
  });
});
