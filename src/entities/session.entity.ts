import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Sesiones de express-session persistidas en MySQL. */
@Entity('session')
export class Session {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'text' })
  sess: string;

  @Index()
  @Column({ type: 'datetime' })
  expire: Date;
}
