import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { AuthToken } from './auth/auth-token.entity';
import { Category } from './reference/category.entity';
import { ObjectType } from './reference/object-type.entity';
import { Place } from './reference/place.entity';
import { Announcement } from './announcements/announcement.entity';

// Used by the migration commands (npm run migration:run, npm run migration:check).
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, AuthToken, Category, ObjectType, Place, Announcement],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
