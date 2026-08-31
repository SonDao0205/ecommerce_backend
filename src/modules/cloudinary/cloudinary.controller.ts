import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { CloudinaryService } from './cloudinary.service';
import type { CloudinaryUploadSignature } from './cloudinary.service';
import { CleanupCloudinaryAssetsDto } from './dto/cleanup-cloudinary-assets.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CleanupReturnEvidenceDto } from './dto/cleanup-return-evidence.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Roles(UserRoleEnum.ADMIN)
  @Post('upload-signature')
  getUploadSignature(): ApiResponseData<CloudinaryUploadSignature> {
    return {
      status: true,
      message: 'Tạo chữ ký tải media thành công',
      data: this.cloudinaryService.createUploadSignature(),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
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

  @Roles(UserRoleEnum.CUSTOMER)
  @Post('return-evidence/upload-signature')
  getReturnEvidenceUploadSignature(
    @Req() req: AuthenticatedRequest,
  ): ApiResponseData<CloudinaryUploadSignature> {
    return {
      status: true,
      message: 'Tạo chữ ký tải minh chứng hoàn trả thành công',
      data: this.cloudinaryService.createUploadSignature(
        `ecommerce/returns/${req.user.id}`,
      ),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.CUSTOMER)
  @Post('return-evidence/cleanup')
  async cleanupReturnEvidence(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CleanupReturnEvidenceDto,
  ): Promise<ApiResponseData<null>> {
    const ownerPrefix = `ecommerce/returns/${req.user.id}/`;
    const ownedAssets = dto.assets.filter((asset) =>
      asset.publicId.startsWith(ownerPrefix),
    );
    await this.cloudinaryService.removeImages(
      ownedAssets.map((asset) => ({ ...asset, url: '' })),
    );
    return {
      status: true,
      message: 'Dọn media minh chứng tạm thành công',
      data: null,
      code: 200,
    };
  }

  @Roles(UserRoleEnum.CUSTOMER)
  @Post('reviews/upload-signature')
  getReviewUploadSignature(
    @Req() req: AuthenticatedRequest,
  ): ApiResponseData<CloudinaryUploadSignature> {
    return {
      status: true,
      message: 'Tạo chữ ký tải media đánh giá thành công',
      data: this.cloudinaryService.createUploadSignature(
        `ecommerce/reviews/${req.user.id}`,
      ),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.CUSTOMER)
  @Post('reviews/cleanup')
  async cleanupReviewMedia(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CleanupReturnEvidenceDto,
  ): Promise<ApiResponseData<null>> {
    const prefix = `ecommerce/reviews/${req.user.id}/`;
    await this.cloudinaryService.removeImages(
      dto.assets
        .filter((asset) => asset.publicId.startsWith(prefix))
        .map((asset) => ({ ...asset, url: '' })),
    );
    return {
      status: true,
      message: 'Dọn media đánh giá tạm thành công',
      data: null,
      code: 200,
    };
  }
}
