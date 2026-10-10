import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReferenceService } from './reference.service';

@ApiTags('reference data')
@Controller('reference-data')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get()
  @ApiOperation({ summary: 'List the categories, precise objects and places used by the forms' })
  @ApiResponse({ status: 200, description: 'Categories with their precise objects, and active places' })
  getAll() {
    return this.referenceService.getAll();
  }
}
