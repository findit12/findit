import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A place on the campus where an object can be lost or found
// (SDD: Place(id, name, building, floor, isActive)).
@Entity('places')
export class Place {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  building!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  floor!: string | null;

  // An inactive place is kept for old announcements but no longer offered in the form.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
