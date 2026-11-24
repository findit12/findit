import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CategoryDto,
  ObjectTypeDto,
  PlaceDto,
  UpdateCategoryDto,
  UpdateObjectTypeDto,
  UpdatePlaceDto,
} from './reference-crud.dto';
import { ReferenceCrudService } from './reference-crud.service';

// Lab 6: "/api/categories", "/api/object-types" and "/api/places". GET is public (the forms need the
// lists), POST, PUT and DELETE need an administrator.

@ApiTags('reference data')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: ReferenceCrudService) {}

  @Get()
  @ApiOperation({ summary: 'List the categories' })
  list() {
    return this.service.listCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one category' })
  @ApiResponse({ status: 404, description: 'Unknown category' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCategory(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a category (administrator)' })
  @ApiResponse({ status: 409, description: 'The name already exists' })
  create(@Body() dto: CategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename a category (administrator)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (administrator)' })
  @ApiResponse({ status: 409, description: 'The category is still used' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeCategory(id);
  }
}

@ApiTags('reference data')
@Controller('object-types')
export class ObjectTypesController {
  constructor(private readonly service: ReferenceCrudService) {}

  @Get()
  @ApiOperation({ summary: 'List the precise objects, optionally of one category (?categoryId=1)' })
  list(@Query('categoryId') categoryId?: string) {
    const id = Number(categoryId);
    return this.service.listObjectTypes(Number.isInteger(id) && id > 0 ? id : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one precise object' })
  @ApiResponse({ status: 404, description: 'Unknown object type' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getObjectType(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a precise object (administrator)' })
  @ApiResponse({ status: 400, description: 'Unknown category' })
  create(@Body() dto: ObjectTypeDto) {
    return this.service.createObjectType(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change a precise object (administrator)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateObjectTypeDto) {
    return this.service.updateObjectType(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a precise object (administrator)' })
  @ApiResponse({ status: 409, description: 'The object type is still used' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeObjectType(id);
  }
}

@ApiTags('reference data')
@Controller('places')
export class PlacesController {
  constructor(private readonly service: ReferenceCrudService) {}

  @Get()
  @ApiOperation({ summary: 'List the places (the inactive ones too)' })
  list() {
    return this.service.listPlaces();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one place' })
  @ApiResponse({ status: 404, description: 'Unknown place' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPlace(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a place (administrator)' })
  @ApiResponse({ status: 409, description: 'The name already exists' })
  create(@Body() dto: PlaceDto) {
    return this.service.createPlace(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a place, or deactivate it with isActive=false (administrator)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlaceDto) {
    return this.service.updatePlace(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a place (administrator)' })
  @ApiResponse({ status: 409, description: 'The place is still used' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.removePlace(id);
  }
}
