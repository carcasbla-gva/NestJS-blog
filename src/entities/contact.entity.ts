import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('contact')
export class Contact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name', length: 255 })
  firstName: string;

  @Column({ name: 'last_name', length: 255 })
  lastName: string;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  message: string;
}
