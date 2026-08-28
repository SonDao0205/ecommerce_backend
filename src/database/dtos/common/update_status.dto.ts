import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateStatusDto {
  @Transform(({ value }: TransformFnParams): unknown => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value as unknown;
  })
  @IsBoolean()
  isActive!: boolean;
}
