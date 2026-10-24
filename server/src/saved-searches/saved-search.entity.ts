import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

// SCRUM-27: a search saved by a user (the filters and the keyword of the gallery).
// A criterion that is null means "no filter on this".
@Entity('saved_searches')
export class SavedSearch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'category_id', type: 'integer', nullable: true })
  categoryId!: number | null;

  @Column({ name: 'object_type_id', type: 'integer', nullable: true })
  objectTypeId!: number | null;

  @Column({ name: 'place_id', type: 'integer', nullable: true })
  placeId!: number | null;

  @Column({ name: 'date_from', type: 'date', nullable: true })
  dateFrom!: string | null;

  @Column({ name: 'date_to', type: 'date', nullable: true })
  dateTo!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  keyword!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
