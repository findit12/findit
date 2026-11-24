import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { In } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Announcement, AnnouncementStatus } from '../announcements/announcement.entity';
import { AuthToken } from '../auth/auth-token.entity';
import { SavedSearch } from '../saved-searches/saved-search.entity';
import { User, UserRole, UserStatus } from './user.entity';
import { UsersService } from './users.service';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 5,
    email: 'sam@school.test',
    passwordHash: 'hash',
    isVerified: true,
    firstName: 'Sam',
    lastName: 'Martin',
    consentAt: new Date('2026-09-01T10:00:00Z'),
    role: UserRole.Student,
    status: UserStatus.Active,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let users: { find: jest.Mock; findOneBy: jest.Mock; save: jest.Mock };
  let tokens: { delete: jest.Mock };
  let savedSearches: { delete: jest.Mock };
  let announcements: { update: jest.Mock };

  // The repository answers with the users of this table, by id.
  function setUsers(...rows: User[]) {
    users.findOneBy.mockImplementation(({ id }: { id: number }) => Promise.resolve(rows.find((row) => row.id === id) ?? null));
    users.find.mockResolvedValue(rows);
  }

  beforeEach(async () => {
    users = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn((row: User) => Promise.resolve(row)) };
    tokens = { delete: jest.fn().mockResolvedValue(undefined) };
    savedSearches = { delete: jest.fn().mockResolvedValue(undefined) };
    announcements = { update: jest.fn().mockResolvedValue({ affected: 2 }) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(AuthToken), useValue: tokens },
        { provide: getRepositoryToken(SavedSearch), useValue: savedSearches },
        { provide: getRepositoryToken(Announcement), useValue: announcements },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('reads my own account and never sends the password hash', async () => {
    setUsers(user());
    const { user: view } = await service.findOne(5, 5);
    expect(view.email).toBe('sam@school.test');
    expect(view).not.toHaveProperty('passwordHash');
  });

  it('refuses a student who reads the account of someone else', async () => {
    setUsers(user(), user({ id: 6 }));
    await expect(service.findOne(5, 6)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an administrator read any account', async () => {
    setUsers(user({ id: 1, role: UserRole.Admin }), user({ id: 6 }));
    const { user: view } = await service.findOne(1, 6);
    expect(view.id).toBe(6);
  });

  it('answers not found for an unknown or deleted account', async () => {
    setUsers(user({ id: 1, role: UserRole.Admin }), user({ id: 7, status: UserStatus.Anonymized }));
    await expect(service.findOne(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(1, 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a signed-in id that no longer exists', async () => {
    setUsers();
    await expect(service.findOne(5, 5)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists the accounts without the deleted ones', async () => {
    setUsers(user(), user({ id: 7, status: UserStatus.Anonymized }));
    const { users: list } = await service.findAll();
    expect(list.map((row) => row.id)).toEqual([5]);
  });

  it('changes only the first and last name', async () => {
    setUsers(user());
    const { user: view } = await service.update(5, 5, { firstName: 'Samuel', lastName: 'Dupont' });
    expect(view.firstName).toBe('Samuel');
    expect(view.lastName).toBe('Dupont');
    expect(view.email).toBe('sam@school.test');
  });

  it('anonymizes the account (FR-25): no personal data left, no way to sign in', async () => {
    setUsers(user());
    await service.remove(5, 5);

    const saved = users.save.mock.calls[0][0] as User;
    expect(saved.email).toBe('deleted-5@deleted.invalid');
    expect(saved.firstName).toBeNull();
    expect(saved.lastName).toBeNull();
    expect(saved.consentAt).toBeNull();
    expect(saved.status).toBe(UserStatus.Anonymized);
    expect(saved.passwordHash).not.toBe('hash');
    expect(saved.passwordHash).toHaveLength(64);
    expect(tokens.delete).toHaveBeenCalledWith({ user: { id: 5 } });
    expect(savedSearches.delete).toHaveBeenCalledWith({ userId: 5 });
  });

  it('archives the announcements of the user that are still public (FR-25)', async () => {
    setUsers(user());
    await service.remove(5, 5);

    expect(announcements.update).toHaveBeenCalledWith(
      { authorId: 5, status: In([AnnouncementStatus.Available, AnnouncementStatus.Open]) },
      { status: AnnouncementStatus.Archived },
    );
  });

  it('refuses to delete the account of someone else', async () => {
    setUsers(user(), user({ id: 6 }));
    await expect(service.remove(5, 6)).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.save).not.toHaveBeenCalled();
  });
});
