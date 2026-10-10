import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Category } from './category.entity';

// A precise object inside a category, for example "Phone" in "Electronics"
// (SDD: ObjectType(id, categoryId, name)).
@Entity('object_types')
export class ObjectType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'category_id' })
  categoryId!: number;

  @ManyToOne(() => Category, (category) => category.objectTypes, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ type: 'varchar', length: 60 })
  name!: string;
}
