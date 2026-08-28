import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class CleanupCloudinaryAssetDto {
  @IsString()
  @Matches(/^ecommerce\/products\//, {
    message: 'Chỉ được dọn media thuộc thư mục sản phẩm',
  })
  publicId!: string;

  @IsIn(['image', 'video'])
  resourceType!: 'image' | 'video';
}

export class CleanupCloudinaryAssetsDto {
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CleanupCloudinaryAssetDto)
  assets!: CleanupCloudinaryAssetDto[];
}
