import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ObjectType } from './object-type.entity';

// A family of objects, for example "Electronics" (SDD: Category(id, name)).
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  name!: string;

  // The precise objects of this category, for example "Phone" or "Laptop".
  @OneToMany(() => ObjectType, (objectType) => objectType.category)
  objectTypes!: ObjectType[];
}
