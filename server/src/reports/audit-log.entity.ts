import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

// FR-19 and SDD section 4 "AuditLog": every moderation action is written here and never changed.
export enum AuditAction {
  Hide = 'hide',
  Restore = 'restore',
  Delete = 'delete',
  Block = 'block',
  Unblock = 'unblock',
}

export enum AuditTarget {
  Announcement = 'announcement',
  User = 'user',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  // The administrator who did the action.
  @Column({ name: 'admin_id' })
  adminId!: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'admin_id' })
  admin!: User;

  @Column({ type: 'varchar', length: 20 })
  action!: AuditAction;

  @Column({ name: 'target_type', type: 'varchar', length: 20 })
  targetType!: AuditTarget;

  @Column({ name: 'target_id', type: 'integer' })
  targetId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
