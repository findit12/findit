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

@Entity('discussions')
export class Discussion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'announcement_id' })
  announcementId!: number;

  @Column({ name: 'owner_id' })
  ownerId!: number;

  @Column({ type: 'text' })
  description!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;

  // FR-14: set when the finder drops the object at the reception; no new message after that.
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @ManyToOne(() => Announcement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement!: Announcement;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;
}