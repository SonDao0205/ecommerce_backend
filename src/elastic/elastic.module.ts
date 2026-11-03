import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '@elastic/elasticsearch';
import { elasticConfig } from '../config/elastic/elastic.config.js';
import { ELASTICSEARCH_CLIENT } from './elastic.constants.js';
import { ElasticProductSearchService } from './elastic-product-search.service.js';
import { ProductSearchOutboxWorker } from './product-search-outbox.worker.js';
import { ProductSearchSyncService } from './product-search-sync.service.js';
import { ElasticIndexState } from './entities/elastic-index-state.entity.js';
import { ProductSearchOutbox } from './entities/product-search-outbox.entity.js';

@Module({
  imports: [
    ConfigModule.forFeature(elasticConfig),
    TypeOrmModule.forFeature([ElasticIndexState, ProductSearchOutbox]),
  ],
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      inject: [elasticConfig.KEY],
      useFactory: async (config: ConfigType<typeof elasticConfig>) => {
        const logger = new Logger('Elasticsearch');
        const client = new Client(config);

        try {
          const info = await client.info();
          logger.log(
            `Kết nối thành công tới ${config.node} (cluster: ${info.cluster_name}, version: ${info.version.number})`,
          );
        } catch (error) {
          logger.error(
            `Kết nối thất bại tới ${config.node}: ${(error as Error).message}`,
          );
        }

        return client;
      },
    },
    ElasticProductSearchService,
    ProductSearchSyncService,
    ProductSearchOutboxWorker,
  ],
  exports: [ElasticProductSearchService, ProductSearchSyncService],
})
export class ElasticModule {}
