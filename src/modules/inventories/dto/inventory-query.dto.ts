import { IsUUID } from 'class-validator';
import { GetAllDto } from 'src/database/dtos/common/get_all.dto';

export class InventoryQueryDto extends GetAllDto {
  @IsUUID('4', { message: 'Danh mục không hợp lệ' })
  categoryId!: string;
}
