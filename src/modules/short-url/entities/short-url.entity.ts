import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('short_urls')
export class ShortUrl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'char', length: 36, name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 16, unique: true, name: 'short_code' })
  shortCode!: string;

  @Column({ type: 'text', name: 'original_url' })
  originalUrl!: string;

  @Column({ type: 'int', unsigned: true, default: 0, name: 'visit_count' })
  visitCount!: number;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
