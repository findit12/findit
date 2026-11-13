import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { User } from '../users/user.entity';

export enum ReportStatus {
  Pending = 'pending',
  Reviewed = 'reviewed',
  Dismissed = 'dismissed',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'announcement_id' })
  announcementId!: number;

  @ManyToOne(() => Announcement, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement!: Announcement;

  @Column({ name: 'reporter_id' })
  reporterId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;

  @Column({ type: 'varchar', length: 1000 })
  reason!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReportStatus.Pending,
  })
  status!: ReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}