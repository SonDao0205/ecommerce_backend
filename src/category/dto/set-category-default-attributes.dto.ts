import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CategoryDefaultAttributeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

export class SetCategoryDefaultAttributesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryDefaultAttributeDto)
  attributes: CategoryDefaultAttributeDto[];
}
