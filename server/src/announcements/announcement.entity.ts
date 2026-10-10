import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Category } from '../reference/category.entity';
import { ObjectType } from '../reference/object-type.entity';
import { Place } from '../reference/place.entity';

export enum AnnouncementType {
  Found = 'found',
  Lost = 'lost',
}

// Life cycle of an announcement (SDD section 4, "Enumerated values").
export enum AnnouncementStatus {
  Available = 'Available', // initial status of a found announcement
  Open = 'Open', // initial status of a lost announcement
  Returned = 'Returned',
  Closed = 'Closed',
  Hidden = 'Hidden',
  Deleted = 'Deleted',
  Archived = 'Archived',
}

// Where a found object is now: kept by the finder, or left at the reception desk.
export enum CurrentLocation {
  Finder = 'finder',
  Reception = 'reception',
}

// One entity for found and lost objects (SDD: "Single Announcement entity").
@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: AnnouncementType, enumName: 'announcement_type' })
  type!: AnnouncementType;

  @Column({ name: 'author_id' })
  authorId!: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ name: 'category_id' })
  categoryId!: number;

  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ name: 'object_type_id' })
  objectTypeId!: number;

  @ManyToOne(() => ObjectType, { nullable: false })
  @JoinColumn({ name: 'object_type_id' })
  objectType!: ObjectType;

  @Column({ type: 'varchar', length: 1000 })
  description!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  brand!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color!: string | null;

  // File names of the photos, stored in the server "uploads" folder.
  @Column({ type: 'text', array: true })
  photos!: string[];

  // Day when the object was found or lost, as "YYYY-MM-DD".
  @Column({ name: 'event_date', type: 'date' })
  eventDate!: string;

  @Column({ name: 'place_id' })
  placeId!: number;

  @ManyToOne(() => Place, { nullable: false })
  @JoinColumn({ name: 'place_id' })
  place!: Place;

  @Column({ name: 'place_details', type: 'varchar', length: 200, nullable: true })
  placeDetails!: string | null;

  // Required for a found object, empty for a lost one.
  @Column({
    name: 'current_location',
    type: 'enum',
    enum: CurrentLocation,
    enumName: 'announcement_current_location',
    nullable: true,
  })
  currentLocation!: CurrentLocation | null;

  // Private detail used to check a claim. Never sent by public endpoints.
  @Column({ name: 'hidden_detail', type: 'varchar', length: 200, nullable: true })
  hiddenDetail!: string | null;

  @Column({ type: 'enum', enum: AnnouncementStatus, enumName: 'announcement_status' })
  status!: AnnouncementStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // createdAt + 90 days: after that, the announcement will be archived (FR-20).
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt!: Date | null;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt!: Date | null;
}
