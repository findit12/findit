import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Discussion } from './discussion.entity';
import { User } from '../users/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'discussion_id' })
  discussionId!: number;

  @Column({ name: 'sender_id' })
  senderId!: number;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;

  @Column({
    name: 'read_at',
    type: 'timestamptz',
    nullable: true,
  })
  readAt!: Date | null;

  // FR-14: a message written by the system (for example "the object was dropped at the reception").
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @ManyToOne(() => Discussion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'discussion_id' })
  discussion!: Discussion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;
}