import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as SafeUserEntity from '../auth/entities/safe-user.entity';
import { CreatePixKeyDto } from './dto/create-pix-key.dto';
import { PixKeysService } from './pix-keys.service';

type SafeUser = SafeUserEntity.SafeUser;

@Controller('pix-keys')
export class PixKeysController {
  constructor(private readonly pixKeysService: PixKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new Pix key' })
  @ApiResponse({
    status: 201,
    description: 'Pix key registered successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid key format or limit reached.',
  })
  @ApiResponse({
    status: 409,
    description: 'Pix key already registered.',
  })
  create(
    @CurrentUser() user: SafeUser,
    @Body() createPixKeyDto: CreatePixKeyDto,
  ) {
    return this.pixKeysService.create(user, createPixKeyDto);
  }

  @Get('masked')
  @ApiOperation({ summary: 'List all Pix keys masked for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Pix keys masked returned successfully.',
  })
  findAllMasked(@CurrentUser() user: SafeUser) {
    return this.pixKeysService.findAllMasked(user);
  }

  @Get()
  @ApiOperation({ summary: 'List all Pix keys for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Pix keys returned successfully.',
  })
  findAll(@CurrentUser() user: SafeUser) {
    return this.pixKeysService.findAll(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Pix key' })
  @ApiResponse({
    status: 200,
    description: 'Pix key deleted successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Pix key not found.',
  })
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.pixKeysService.remove(user, id);
  }
}
