import { randomBytes } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthToken } from '../auth/auth-token.entity';
import { SavedSearch } from '../saved-searches/saved-search.entity';
import { UpdateUserDto } from './update-user.dto';
import { User, UserRole, UserStatus } from './user.entity';

// Lab 6: the CRUD of the User entity (FR-25 for the deletion).
// A student can read, change and delete only their own account. An administrator can do it for every account.
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthToken) private readonly tokens: Repository<AuthToken>,
    @InjectRepository(SavedSearch) private readonly savedSearches: Repository<SavedSearch>,
  ) {}

  // The password hash is never sent.
  private toView(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  // Loads the account and checks that the signed-in user may use it.
  private async findAllowed(actingUserId: number, id: number): Promise<User> {
    const acting = await this.users.findOneBy({ id: actingUserId });
    if (!acting) {
      throw new ForbiddenException('You cannot use this account.');
    }
    if (acting.id !== id && acting.role !== UserRole.Admin) {
      throw new ForbiddenException('You can only use your own account.');
    }
    const user = await this.users.findOneBy({ id });
    if (!user || user.status === UserStatus.Anonymized) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  // GET /api/users (administrator): every account that still exists, oldest first.
  async findAll() {
    const users = await this.users.find({ order: { id: 'ASC' } });
    return {
      users: users.filter((user) => user.status !== UserStatus.Anonymized).map((user) => this.toView(user)),
    };
  }

  async findOne(actingUserId: number, id: number) {
    return { user: this.toView(await this.findAllowed(actingUserId, id)) };
  }

  async update(actingUserId: number, id: number, dto: UpdateUserDto) {
    const user = await this.findAllowed(actingUserId, id);
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    return { user: this.toView(await this.users.save(user)) };
  }

  // FR-25: the account is anonymized, not removed, because the announcements, discussions and
  // reports of the user point to the row. The personal data are erased, the password can no longer be
  // used, the verification and reset links are deleted and the saved searches are removed.
  async remove(actingUserId: number, id: number): Promise<void> {
    const user = await this.findAllowed(actingUserId, id);

    user.email = `deleted-${user.id}@deleted.invalid`;
    user.firstName = null;
    user.lastName = null;
    user.consentAt = null;
    user.passwordHash = randomBytes(32).toString('hex');
    user.isVerified = false;
    user.status = UserStatus.Anonymized;
    await this.users.save(user);

    await this.tokens.delete({ user: { id } });
    await this.savedSearches.delete({ userId: id });
  }
}
