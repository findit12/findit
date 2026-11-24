import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';
import { Claim, ClaimStatus } from './claim.entity';
import { CreateClaimDto, UpdateClaimDto } from './claim.dto';

// SCRUM-53 (FR-16): the "ClaimService" of the SDD.
@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    @InjectRepository(Claim) private readonly claims: Repository<Claim>,
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    private readonly mail: MailService,
  ) {}

  // POST /api/announcements/:id/claims
  async create(userId: number, announcementId: number, dto: CreateClaimDto) {
    const announcement = await this.announcements.findOneBy({ id: announcementId });
    if (
      !announcement ||
      announcement.status === AnnouncementStatus.Deleted ||
      announcement.status === AnnouncementStatus.Hidden
    ) {
      throw new NotFoundException('Announcement not found.');
    }
    if (announcement.authorId === userId) {
      throw new ForbiddenException('You cannot claim your own announcement.');
    }
    if (
      announcement.type !== AnnouncementType.Found ||
      announcement.currentLocation !== CurrentLocation.Reception
    ) {
      throw new ConflictException('This object is not at the reception desk.');
    }
    if (announcement.status !== AnnouncementStatus.Available) {
      throw new ConflictException('This announcement is no longer available.');
    }
    const existing = await this.claims.findOneBy({ announcementId, claimantId: userId });
    if (existing) {
      throw new ConflictException({ error: 'You already claimed this object.', claimId: existing.id });
    }

    const claim = await this.claims.save(
      this.claims.create({ announcementId, claimantId: userId, proof: dto.proof, status: ClaimStatus.Pending }),
    );
    return { message: 'Claim submitted successfully.', claim: this.view(claim) };
  }

  // Lab 6: GET /api/claims, my claims.
  async findMine(userId: number) {
    const claims = await this.claims.find({ where: { claimantId: userId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return { claims: claims.map((claim) => this.view(claim)) };
  }

  // Lab 6: GET /api/claims/:id
  async findOne(userId: number, id: number) {
    return { claim: this.view(await this.findOwn(userId, id)) };
  }

  // Lab 6: PUT /api/claims/:id, merge, only while the staff has not answered.
  async update(userId: number, id: number, dto: UpdateClaimDto) {
    const claim = await this.findOwn(userId, id);
    this.assertPending(claim);
    const merged = { ...claim, ...dto };
    await this.claims.save(merged);
    return { claim: this.view(merged as Claim) };
  }

  // Lab 6: DELETE /api/claims/:id, the claimant withdraws a pending claim.
  async remove(userId: number, id: number): Promise<void> {
    const claim = await this.findOwn(userId, id);
    this.assertPending(claim);
    await this.claims.delete(claim.id);
  }

  // GET /api/admin/claims: the pending claims of the objects that are still waiting, with the
  // hidden detail next to the proof, so the staff can compare them (FR-16).
  async listPending() {
    const claims = await this.claims.find({
      where: { status: ClaimStatus.Pending, announcement: { status: AnnouncementStatus.Available } },
      relations: { announcement: true, claimant: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return {
      claims: claims.map((claim) => ({
        ...this.view(claim),
        announcementTitle: claim.announcement.title,
        hiddenDetail: claim.announcement.hiddenDetail,
        // NFR-PRIV-02: the name only, never the email.
        claimant: { id: claim.claimant.id, firstName: claim.claimant.firstName ?? null, lastName: claim.claimant.lastName ?? null },
      })),
    };
  }

  // POST /api/admin/claims/:id/confirm-handover
  async confirm(adminId: number, id: number) {
    const claim = await this.findForStaff(id);
    const announcement = claim.announcement;
    if (announcement.status !== AnnouncementStatus.Available) {
      throw new ConflictException('This announcement is no longer available.');
    }

    const now = new Date();
    await this.claims.update(claim.id, { status: ClaimStatus.Accepted, reviewedById: adminId, reviewedAt: now });
    await this.announcements.update(announcement.id, { status: AnnouncementStatus.Returned, returnedAt: now });

    const info = { id: announcement.id, title: announcement.title };
    for (const email of [announcement.author.email, claim.claimant.email]) {
      void this.mail
        .receptionHandover(email, info)
        .catch((err) => this.logger.error(`Failed to send the handover email for claim ${claim.id}`, err));
    }

    return {
      message: 'Handover confirmed successfully.',
      claimId: claim.id,
      announcementId: announcement.id,
      status: AnnouncementStatus.Returned,
      returnedAt: now,
    };
  }

  // POST /api/admin/claims/:id/decline: the announcement stays Available.
  async decline(adminId: number, id: number) {
    const claim = await this.findForStaff(id);
    const now = new Date();
    await this.claims.update(claim.id, { status: ClaimStatus.Declined, reviewedById: adminId, reviewedAt: now });

    void this.mail
      .claimDeclined(claim.claimant.email, { id: claim.announcement.id, title: claim.announcement.title })
      .catch((err) => this.logger.error(`Failed to send the declined email for claim ${claim.id}`, err));

    return { message: 'Claim declined.', claimId: claim.id, announcementId: claim.announcement.id };
  }

  private async findForStaff(id: number): Promise<Claim> {
    const claim = await this.claims.findOne({
      where: { id },
      relations: { announcement: { author: true }, claimant: true },
    });
    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }
    this.assertPending(claim);
    return claim;
  }

  private async findOwn(userId: number, id: number): Promise<Claim> {
    const claim = await this.claims.findOneBy({ id });
    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }
    if (claim.claimantId !== userId) {
      throw new ForbiddenException('This is not your claim.');
    }
    return claim;
  }

  private assertPending(claim: Claim): void {
    if (claim.status !== ClaimStatus.Pending) {
      throw new ConflictException(`This claim is already ${claim.status}.`);
    }
  }

  private view(claim: Claim) {
    return {
      id: claim.id,
      announcementId: claim.announcementId,
      claimantId: claim.claimantId,
      proof: claim.proof,
      status: claim.status,
      reviewedAt: claim.reviewedAt ?? null,
      createdAt: claim.createdAt,
    };
  }
}
