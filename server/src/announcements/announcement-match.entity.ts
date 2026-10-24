import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Announcement } from './announcement.entity';

@Entity('announcement_matches')
@Unique('UQ_announcement_matches_pair', ['announcementId', 'matchedAnnouncementId'])
@Check('"announcement_id" < "matched_announcement_id"')
@Check('"score" >= 0 AND "score" <= 100')
export class AnnouncementMatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'announcement_id', type: 'integer' })
  announcementId!: number;

  @ManyToOne(() => Announcement, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement!: Announcement;

  @Column({ name: 'matched_announcement_id', type: 'integer' })
  matchedAnnouncementId!: number;

  @ManyToOne(() => Announcement, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matched_announcement_id' })
  matchedAnnouncement!: Announcement;

  @Column({ type: 'integer' })
  score!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
