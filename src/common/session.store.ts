import session from 'express-session';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';

/**
 * Almacén de sesiones de express-session sobre TypeORM/MySQL.
 * Evita el MemoryStore, que pierde las sesiones al reiniciar y no escala.
 */
export class TypeOrmSessionStore extends session.Store {
  constructor(
    private readonly repository: Repository<Session>,
    private readonly ttlMs = 1000 * 60 * 60 * 8,
  ) {
    super();
  }

  get(
    sid: string,
    callback: (err: unknown, session?: session.SessionData | null) => void,
  ): void {
    this.repository
      .findOne({ where: { id: sid } })
      .then((row) => {
        if (!row) {
          callback(null, null);
          return;
        }
        if (row.expire.getTime() <= Date.now()) {
          void this.repository.delete(sid);
          callback(null, null);
          return;
        }
        try {
          callback(null, JSON.parse(row.sess) as session.SessionData);
        } catch {
          void this.repository.delete(sid);
          callback(null, null);
        }
      })
      .catch((error) => callback(error));
  }

  set(
    sid: string,
    value: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    const expires = value.cookie?.expires;
    const expire =
      expires instanceof Date
        ? expires
        : new Date(Date.now() + this.ttlMs);

    this.repository
      .save({ id: sid, sess: JSON.stringify(value), expire })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(
    sid: string,
    value: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    const expires = value.cookie?.expires;
    const expire =
      expires instanceof Date
        ? expires
        : new Date(Date.now() + this.ttlMs);

    this.repository
      .update({ id: sid }, { expire })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.repository
      .delete({ id: sid })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  /** Elimina sesiones caducadas; se puede invocar periódicamente. */
  async clearExpired(): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .where('expire <= :now', { now: new Date() })
      .execute();
  }
}
