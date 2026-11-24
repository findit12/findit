import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';
import { Claim, ClaimStatus } from './claim.entity';
import { ClaimsService } from './claims.service';

describe('ClaimsService (SCRUM-53, FR-16)', () => {
  let service: ClaimsService;
  let claims: Record<'findOneBy' | 'find' | 'findOne' | 'save' | 'create' | 'update' | 'delete', jest.Mock>;
  let announcements: { findOneBy: jest.Mock; update: jest.Mock };
  let mail: { receptionHandover: jest.Mock; claimDeclined: jest.Mock };

  const announcement = (extra: Partial<Announcement> = {}) =>
    ({
      id: 8,
      authorId: 5,
      type: AnnouncementType.Found,
      status: AnnouncementStatus.Available,
      currentLocation: CurrentLocation.Reception,
      title: 'Black phone',
      hiddenDetail: 'Cat sticker',
      author: { email: 'finder@school.test' },
      ...extra,
    }) as Announcement;

  const claim = (extra: Partial<Claim> = {}) =>
    ({
      id: 1,
      announcementId: 8,
      claimantId: 9,
      proof: 'A cat sticker',
      status: ClaimStatus.Pending,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date('2026-11-02T10:00:00Z'),
      announcement: announcement(),
      claimant: { id: 9, email: 'owner@school.test', firstName: 'Own', lastName: 'Er' },
      ...extra,
    }) as Claim;

  beforeEach(async () => {
    claims = {
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(claim()),
      save: jest.fn(async (x) => ({ id: 1, createdAt: new Date('2026-11-02T10:00:00Z'), reviewedAt: null, ...x })),
      create: jest.fn((x) => x),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };
    announcements = { findOneBy: jest.fn().mockResolvedValue(announcement()), update: jest.fn().mockResolvedValue({}) };
    mail = {
      receptionHandover: jest.fn().mockResolvedValue(undefined),
      claimDeclined: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClaimsService,
        { provide: getRepositoryToken(Claim), useValue: claims },
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = module.get(ClaimsService);
  });

  describe('create', () => {
    it('saves a pending claim with the proof', async () => {
      const result = await service.create(9, 8, { proof: 'A cat sticker' });

      expect(claims.create).toHaveBeenCalledWith({
        announcementId: 8,
        claimantId: 9,
        proof: 'A cat sticker',
        status: ClaimStatus.Pending,
      });
      expect(result.claim).toMatchObject({ id: 1, status: 'pending', proof: 'A cat sticker' });
    });

    it('refuses an unknown, deleted or hidden announcement (404)', async () => {
      announcements.findOneBy.mockResolvedValue(null);
      await expect(service.create(9, 8, { proof: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      announcements.findOneBy.mockResolvedValue(announcement({ status: AnnouncementStatus.Hidden }));
      await expect(service.create(9, 8, { proof: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses the author of the announcement (403)', async () => {
      await expect(service.create(5, 8, { proof: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses an object kept by its finder, and a lost announcement (409)', async () => {
      announcements.findOneBy.mockResolvedValue(announcement({ currentLocation: CurrentLocation.Finder }));
      await expect(service.create(9, 8, { proof: 'x' })).rejects.toThrow('not at the reception');
      announcements.findOneBy.mockResolvedValue(announcement({ type: AnnouncementType.Lost, currentLocation: null }));
      await expect(service.create(9, 8, { proof: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses an announcement that is no longer Available (409)', async () => {
      announcements.findOneBy.mockResolvedValue(announcement({ status: AnnouncementStatus.Returned }));
      await expect(service.create(9, 8, { proof: 'x' })).rejects.toThrow('no longer available');
    });

    it('allows one claim per user and announcement, and gives the id of the first one (409)', async () => {
      claims.findOneBy.mockResolvedValue(claim());
      await expect(service.create(9, 8, { proof: 'x' })).rejects.toMatchObject({
        response: { error: 'You already claimed this object.', claimId: 1 },
      });
      expect(claims.save).not.toHaveBeenCalled();
    });
  });

  describe('my claims (Lab 6)', () => {
    it('lists only my claims', async () => {
      claims.find.mockResolvedValue([claim()]);
      const { claims: list } = await service.findMine(9);
      expect(claims.find).toHaveBeenCalledWith({ where: { claimantId: 9 }, order: { createdAt: 'DESC', id: 'DESC' } });
      expect(list).toHaveLength(1);
    });

    it('reads my claim, and refuses the claim of someone else (403) or an unknown one (404)', async () => {
      claims.findOneBy.mockResolvedValue(claim());
      await expect(service.findOne(9, 1)).resolves.toMatchObject({ claim: { id: 1 } });
      await expect(service.findOne(10, 1)).rejects.toBeInstanceOf(ForbiddenException);
      claims.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(9, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('PUT merges: the proof changes, the other fields keep their value', async () => {
      claims.findOneBy.mockResolvedValue(claim());
      const result = await service.update(9, 1, { proof: 'A cat sticker and a crack' });
      expect(claims.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, announcementId: 8, claimantId: 9, proof: 'A cat sticker and a crack' }),
      );
      expect(result.claim.proof).toBe('A cat sticker and a crack');

      claims.save.mockClear();
      const same = await service.update(9, 1, {});
      expect(same.claim.proof).toBe('A cat sticker');
    });

    it('refuses to change or withdraw a claim that was already handled (409)', async () => {
      claims.findOneBy.mockResolvedValue(claim({ status: ClaimStatus.Declined }));
      await expect(service.update(9, 1, { proof: 'x' })).rejects.toBeInstanceOf(ConflictException);
      await expect(service.remove(9, 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('withdraws a pending claim', async () => {
      claims.findOneBy.mockResolvedValue(claim());
      await service.remove(9, 1);
      expect(claims.delete).toHaveBeenCalledWith(1);
    });

    it('does not let someone else change or withdraw my claim (403)', async () => {
      claims.findOneBy.mockResolvedValue(claim());
      await expect(service.update(10, 1, { proof: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(10, 1)).rejects.toBeInstanceOf(ForbiddenException);
      expect(claims.delete).not.toHaveBeenCalled();
    });
  });

  describe('staff queue', () => {
    it('lists the pending claims with the hidden detail and the name (never the email) of the claimant', async () => {
      claims.find.mockResolvedValue([claim()]);
      const { claims: list } = await service.listPending();

      expect(claims.find.mock.calls[0][0].where).toEqual({
        status: ClaimStatus.Pending,
        announcement: { status: AnnouncementStatus.Available },
      });
      expect(list[0]).toMatchObject({
        announcementTitle: 'Black phone',
        hiddenDetail: 'Cat sticker',
        proof: 'A cat sticker',
        claimant: { id: 9, firstName: 'Own', lastName: 'Er' },
      });
      expect(JSON.stringify(list)).not.toContain('owner@school.test');
    });

    it('confirms the handover: Returned, date recorded, finder and claimant emailed', async () => {
      const result = await service.confirm(1, 1);

      expect(claims.update).toHaveBeenCalledWith(1, {
        status: ClaimStatus.Accepted,
        reviewedById: 1,
        reviewedAt: expect.any(Date),
      });
      expect(announcements.update).toHaveBeenCalledWith(8, {
        status: AnnouncementStatus.Returned,
        returnedAt: expect.any(Date),
      });
      expect(mail.receptionHandover).toHaveBeenCalledWith('finder@school.test', { id: 8, title: 'Black phone' });
      expect(mail.receptionHandover).toHaveBeenCalledWith('owner@school.test', { id: 8, title: 'Black phone' });
      expect(result).toMatchObject({ announcementId: 8, status: 'Returned' });
    });

    it('does not confirm when the announcement is no longer Available (409)', async () => {
      claims.findOne.mockResolvedValue(claim({ announcement: announcement({ status: AnnouncementStatus.Returned }) }));
      await expect(service.confirm(1, 1)).rejects.toBeInstanceOf(ConflictException);
      expect(announcements.update).not.toHaveBeenCalled();
    });

    it('declines: the claimant is emailed and the announcement is not changed', async () => {
      await service.decline(1, 1);

      expect(claims.update).toHaveBeenCalledWith(1, {
        status: ClaimStatus.Declined,
        reviewedById: 1,
        reviewedAt: expect.any(Date),
      });
      expect(announcements.update).not.toHaveBeenCalled();
      expect(mail.claimDeclined).toHaveBeenCalledWith('owner@school.test', { id: 8, title: 'Black phone' });
    });

    it('refuses an unknown claim (404) and a claim already handled (409)', async () => {
      claims.findOne.mockResolvedValue(null);
      await expect(service.confirm(1, 99)).rejects.toBeInstanceOf(NotFoundException);
      claims.findOne.mockResolvedValue(claim({ status: ClaimStatus.Accepted }));
      await expect(service.decline(1, 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('still answers when an email fails', async () => {
      mail.claimDeclined.mockRejectedValue(new Error('SMTP down'));
      await expect(service.decline(1, 1)).resolves.toMatchObject({ claimId: 1 });
    });
  });
});
