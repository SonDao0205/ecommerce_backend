import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReviewMediaDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) url!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) publicId!: string;
  @IsIn(['image', 'video']) resourceType!: 'image' | 'video';
}

export class CreateReviewDto {
  @IsUUID() orderItemId!: string;
  @Type(() => Number) @IsInt() @IsIn([1, 2, 3, 4, 5]) rating!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  content!: string;
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ReviewMediaDto)
  media: ReviewMediaDto[] = [];
}
