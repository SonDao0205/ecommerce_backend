import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

class CleanupReturnEvidenceAssetDto {
  @IsString()
  @Matches(/^ecommerce\/returns\/[0-9a-f-]+\//i)
  publicId!: string;

  @IsIn(['image', 'video'])
  resourceType!: 'image' | 'video';
}

export class CleanupReturnEvidenceDto {
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CleanupReturnEvidenceAssetDto)
  assets!: CleanupReturnEvidenceAssetDto[];
}
