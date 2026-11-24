import { Injectable } from '@nestjs/common';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementType, CurrentLocation } from '../announcements/announcement.entity';
import { CreateAnnouncementDto } from '../announcements/announcements.dto';
import { ReferenceService, UNIDENTIFIED } from '../reference/reference.service';
import { ReceptionDeclarationDto } from './reception-declaration.dto';

export const RECEPTION_DEFAULT_TITLE = 'Object left at reception';
export const RECEPTION_DEFAULT_DESCRIPTION = 'Object handed to the reception staff.';

// Today as "YYYY-MM-DD", in the time zone of the server (same rule as the normal declaration).
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// SCRUM-54 (FR-32): declaration by the reception staff with a photo as the only mandatory field.
// The announcement is created by the normal declaration (photo rules, confirmation email, saved
// search alerts, matching). The daily limit does not apply to an administrator (FR-31).
@Injectable()
export class ReceptionDeclarationService {
  constructor(
    private readonly announcements: AnnouncementsService,
    private readonly reference: ReferenceService,
  ) {}

  async declare(adminId: number, dto: ReceptionDeclarationDto, files: Express.Multer.File[]) {
    const { categoryId, objectTypeId, placeId } = await this.reference.getUnidentified();

    const declaration: CreateAnnouncementDto = {
      type: AnnouncementType.Found,
      title: RECEPTION_DEFAULT_TITLE,
      categoryId,
      objectTypeId,
      description: RECEPTION_DEFAULT_DESCRIPTION,
      eventDate: today(),
      placeId,
      placeDetails: UNIDENTIFIED,
      currentLocation: CurrentLocation.Reception,
      hiddenDetail: dto.hiddenDetail,
    };
    return this.announcements.create(adminId, declaration, files);
  }
}
