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

  @ManyToOne(() => Discussion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'discussion_id' })
  discussion!: Discussion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;
}