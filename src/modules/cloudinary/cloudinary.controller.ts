import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { CloudinaryService } from './cloudinary.service';
import type { CloudinaryUploadSignature } from './cloudinary.service';
import { CleanupCloudinaryAssetsDto } from './dto/cleanup-cloudinary-assets.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('upload-signature')
  getUploadSignature(): ApiResponseData<CloudinaryUploadSignature> {
    return {
      status: true,
      message: 'Tạo chữ ký tải media thành công',
      data: this.cloudinaryService.createUploadSignature(),
      code: 200,
    };
  }

  @Post('cleanup')
  async cleanup(
    @Body() dto: CleanupCloudinaryAssetsDto,
  ): Promise<ApiResponseData<null>> {
    await this.cloudinaryService.removeImages(
      dto.assets.map((asset) => ({ ...asset, url: '' })),
    );
    return {
      status: true,
      message: 'Dọn media tạm thành công',
      data: null,
      code: 200,
    };
  }
}
