import {
  Injectable,
  MessageEvent,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Observable, Subject, interval, map, merge } from 'rxjs';

interface PostgresNotification {
  channel: string;
  payload?: string;
}

interface PostgresConnection {
  on(
    event: 'notification',
    listener: (message: PostgresNotification) => void,
  ): void;
  removeListener(
    event: 'notification',
    listener: (message: PostgresNotification) => void,
  ): void;
}

@Injectable()
export class AuditLogStreamService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly events = new Subject<MessageEvent>();
  private queryRunner?: QueryRunner;
  private connection?: PostgresConnection;

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queryRunner = this.dataSource.createQueryRunner();
    this.connection = (await this.queryRunner.connect()) as PostgresConnection;
    this.connection.on('notification', this.handleNotification);
    await this.queryRunner.query('LISTEN audit_log_created');
  }

  stream(): Observable<MessageEvent> {
    const heartbeat = interval(15_000).pipe(
      map(() => ({ type: 'heartbeat', data: { timestamp: Date.now() } })),
    );
    return merge(this.events.asObservable(), heartbeat);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.queryRunner && !this.queryRunner.isReleased) {
      await this.queryRunner.query('UNLISTEN audit_log_created');
      if (this.connection) {
        this.connection.removeListener('notification', this.handleNotification);
      }
      await this.queryRunner.release();
    }
    this.events.complete();
  }

  private readonly handleNotification = (message: PostgresNotification) => {
    if (message.channel !== 'audit_log_created' || !message.payload) return;
    try {
      const parsed: unknown = JSON.parse(message.payload);
      const data: string | object =
        typeof parsed === 'string' ||
        (typeof parsed === 'object' && parsed !== null)
          ? parsed
          : { id: message.payload };
      this.events.next({
        type: 'audit-log',
        data,
      });
    } catch {
      this.events.next({ type: 'audit-log', data: { id: message.payload } });
    }
  };
}
