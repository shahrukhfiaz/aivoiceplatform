import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CallerIdNumber } from './caller-id-number.entity';

export type RotationStrategy = 'round_robin' | 'random' | 'weighted' | 'least_recently_used';

@Entity()
export class CallerIdPool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  localPresenceEnabled: boolean;

  @Column({ type: 'text', default: 'round_robin' })
  rotationStrategy: RotationStrategy;

  @Column({ type: 'integer', default: 50 })
  maxCallsPerNumber: number;

  @Column({ type: 'integer', default: 60 })
  cooldownMinutes: number;

  @OneToMany(() => CallerIdNumber, (number) => number.pool)
  numbers?: CallerIdNumber[];

  // Computed stats (not persisted)
  totalNumbers?: number;
  activeNumbers?: number;
  flaggedNumbers?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
