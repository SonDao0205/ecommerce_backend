import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateShopDto } from './create-shop.dto.js';

export class UpdateShopDto extends PartialType(CreateShopDto) {
  @IsString()
  @IsOptional()
  readonly logo_url?: string | null;

  @IsString()
  @IsOptional()
  readonly banner_url?: string | null;
}
