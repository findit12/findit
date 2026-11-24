import { Body, Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReceptionDeclarationDto } from './reception-declaration.dto';
import { ReceptionDeclarationService } from './reception-declaration.service';

// Same limits as the normal declaration: checkPhotos() then answers with a clear message.
const UPLOAD_LIMITS = { files: 10, fileSize: 20 * 1024 * 1024 };

// SCRUM-54 (FR-32, SDD section 5): POST /api/admin/announcements. Administrators only.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/announcements')
export class AdminReceptionController {
  constructor(private readonly service: ReceptionDeclarationService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('photos', UPLOAD_LIMITS.files, { limits: UPLOAD_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Reception staff: declare an object handed to the reception (photos only)' })
  @ApiResponse({ status: 201, description: 'Found announcement at the reception, with default values; matching runs' })
  @ApiResponse({ status: 400, description: 'No photo, or invalid photos' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Administrator access required' })
  declare(
    @CurrentUserId() adminId: number,
    @Body() dto: ReceptionDeclarationDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.service.declare(adminId, dto, files);
  }
}
