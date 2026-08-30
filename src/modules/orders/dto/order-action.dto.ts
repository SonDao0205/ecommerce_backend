import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

class ReasonDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Lý do không được để trống' })
  @MinLength(5, { message: 'Lý do phải có ít nhất 5 ký tự' })
  @MaxLength(1000)
  reason!: string;
}

export class CancelMyOrderDto extends ReasonDto {}

export class ReturnEvidenceDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'URL minh chứng không hợp lệ' },
  )
  @MaxLength(2000)
  url!: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^ecommerce\/returns\/[0-9a-f-]+\//i, {
    message: 'Media minh chứng không thuộc thư mục hoàn trả',
  })
  @MaxLength(500)
  publicId!: string;

  @IsIn(['image', 'video'])
  resourceType!: 'image' | 'video';
}

export class RequestOrderReturnDto extends ReasonDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'Chỉ được gửi tối đa 6 media minh chứng' })
  @ValidateNested({ each: true })
  @Type(() => ReturnEvidenceDto)
  evidence?: ReturnEvidenceDto[];
}

export class ReviewOrderReturnDto extends ReasonDto {
  @IsBoolean()
  approved!: boolean;
}
