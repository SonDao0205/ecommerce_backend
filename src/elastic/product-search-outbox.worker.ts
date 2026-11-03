import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ElasticProductSearchService } from './elastic-product-search.service.js';
import { PRODUCT_SEARCH_ALIAS } from './elastic.constants.js';

@Injectable()
export class ProductSearchOutboxWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProductSearchOutboxWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private busy = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly search: ElasticProductSearchService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 1500);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const created = await this.search.ensureIndex();
      if (created) {
        await this.dataSource.query(
          `INSERT INTO elastic_index_states (alias, backfill_completed)
           VALUES ($1, FALSE) ON CONFLICT (alias) DO UPDATE
           SET backfill_completed = FALSE, updated_at = CURRENT_TIMESTAMP`,
          [PRODUCT_SEARCH_ALIAS],
        );
      }
      const [state] = await this.dataSource.query(
        `INSERT INTO elastic_index_states (alias) VALUES ($1)
         ON CONFLICT (alias) DO UPDATE SET alias = EXCLUDED.alias
         RETURNING backfill_completed, backfill_locked_at`,
        [PRODUCT_SEARCH_ALIAS],
      );
      if (!state?.backfill_completed) {
        this.search.setReady(false);
        const claimed = await this.claimBackfill();
        if (claimed) await this.runBackfill();
        return;
      }
      this.search.setReady(true);
      await this.processBatch();
    } catch (error) {
      this.logger.error(
        `Product search sync cycle failed: ${(error as Error).message}`,
      );
    } finally {
      this.busy = false;
    }
  }

  private async claimBackfill(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `UPDATE elastic_index_states SET backfill_locked_at = CURRENT_TIMESTAMP
       WHERE alias = $1 AND backfill_completed = FALSE
         AND (backfill_locked_at IS NULL OR backfill_locked_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
       RETURNING alias`,
      [PRODUCT_SEARCH_ALIAS],
    );
    return rows.length > 0;
  }

  private async runBackfill(): Promise<void> {
    try {
      await this.search.reindexAll();
      await this.dataSource.query(
        `UPDATE elastic_index_states SET backfill_completed = TRUE,
         backfill_locked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE alias = $1`,
        [PRODUCT_SEARCH_ALIAS],
      );
      this.search.setReady(true);
    } catch (error) {
      await this.dataSource.query(
        `UPDATE elastic_index_states SET backfill_locked_at = NULL WHERE alias = $1`,
        [PRODUCT_SEARCH_ALIAS],
      );
      throw error;
    }
  }

  private async processBatch(): Promise<void> {
    const [claimed] = (await this.dataSource.query(
      `WITH candidates AS (
         SELECT o.id FROM product_search_outbox o
         WHERE o.processed_at IS NULL AND o.next_attempt_at <= CURRENT_TIMESTAMP
           AND (o.locked_at IS NULL OR o.locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
           AND NOT EXISTS (
             SELECT 1 FROM product_search_outbox earlier
             WHERE earlier.product_id = o.product_id AND earlier.processed_at IS NULL
               AND earlier.id < o.id
           )
         ORDER BY o.id FOR UPDATE SKIP LOCKED LIMIT 100
       )
       UPDATE product_search_outbox o SET locked_at = CURRENT_TIMESTAMP
       FROM candidates c WHERE o.id = c.id
       RETURNING o.id::text AS id, o.product_id::text AS product_id`,
    )) as [Array<{ id: string; product_id: string }>, number];

    if (claimed.length === 0) return;

    for (const item of claimed) {
      if (!item?.id || !item.product_id) {
        this.logger.error(
          `Outbox claim returned invalid identifiers. Returned columns: ${Object.keys(item ?? {}).join(', ') || '(none)'}`,
        );
        continue;
      }
      try {
        // Re-read current DB state; duplicate/out-of-order events converge to latest data.
        await this.search.syncProduct(item.product_id);
        await this.dataSource.query(
          `UPDATE product_search_outbox SET processed_at = CURRENT_TIMESTAMP,
           locked_at = NULL, last_error = NULL WHERE id = $1`,
          [item.id],
        );
      } catch (error) {
        const message = (error as Error).message.slice(0, 1900);
        await this.dataSource.query(
          `UPDATE product_search_outbox SET attempts = attempts + 1, last_error = $2,
           locked_at = NULL, next_attempt_at = CURRENT_TIMESTAMP +
             LEAST(INTERVAL '5 minutes', INTERVAL '2 seconds' * power(2, LEAST(attempts, 7)))
           WHERE id = $1`,
          [item.id, message],
        );
        this.logger.warn(
          `Outbox item ${item.id} failed and will retry: ${message}`,
        );
      }
    }
  }
}
