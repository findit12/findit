import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { User } from '../users/user.entity';

export enum ClaimStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
}

// FR-16: a claim on an object held at the reception. One claim per user and announcement.
@Entity('claims')
@Unique('UQ_claims_announcement_claimant', ['announcementId', 'claimantId'])
export class Claim {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'announcement_id' })
  announcementId!: number;

  @Column({ name: 'claimant_id' })
  claimantId!: number;

  // The hidden detail, described by the claimant. Readable by the claimant and the staff only.
  @Column({ type: 'text' })
  proof!: string;

  @Column({ type: 'varchar', length: 20, default: ClaimStatus.Pending })
  status!: ClaimStatus;

  @Column({ name: 'reviewed_by_id', type: 'integer', nullable: true })
  reviewedById!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @ManyToOne(() => Announcement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement!: Announcement;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claimant_id' })
  claimant!: User;
}
