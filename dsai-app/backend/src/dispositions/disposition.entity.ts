import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DispositionCategory = 'positive' | 'negative' | 'neutral' | 'callback';

@Entity()
export class Disposition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: 'neutral' })
  category: DispositionCategory;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'boolean', default: false })
  markAsDnc: boolean;

  @Column({ type: 'boolean', default: false })
  scheduleCallback: boolean;

  @Column({ type: 'integer', nullable: true })
  retryAfterMinutes?: number | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
