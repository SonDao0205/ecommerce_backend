import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface UploadedImage {
  url: string;
  publicId: string;
  resourceType: 'image' | 'video';
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadImages(files: Express.Multer.File[]): Promise<UploadedImage[]> {
    if (files.length === 0) return [];
    files.forEach((file) => {
      const limit = file.mimetype.startsWith('video/')
        ? 50 * 1024 * 1024
        : 5 * 1024 * 1024;
      if (file.size > limit) {
        throw new BadRequestException(
          `${file.originalname}: ảnh tối đa 5 MB, video tối đa 50 MB`,
        );
      }
    });
    this.ensureConfigured();
    // allSettled giữ đúng thứ tự files và cho phép dọn các ảnh đã tải nếu một ảnh lỗi.
    const results = await Promise.allSettled(
      files.map((file) => this.uploadImage(file)),
    );
    const uploaded = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) {
      await this.removeImages(uploaded);
      const failedIndexes = results.flatMap((result, index) =>
        result.status === 'rejected' ? [index] : [],
      );
      throw new InternalServerErrorException({
        message: 'Một hoặc nhiều ảnh không thể tải lên Cloudinary',
        failedIndexes,
      });
    }
    return uploaded;
  }

  async removeImages(assets: UploadedImage[]): Promise<void> {
    await Promise.allSettled(
      assets.map((asset) =>
        cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
        }),
      ),
    );
  }

  private uploadImage(file: Express.Multer.File): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'ecommerce/products',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                'Không thể tải ảnh lên Cloudinary',
              ),
            );
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type === 'video' ? 'video' : 'image',
          });
        },
      );
      Readable.from(file.buffer).pipe(upload);
    });
  }

  private ensureConfigured(): void {
    const required = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    if (required.some((key) => !this.configService.get<string>(key))) {
      throw new ServiceUnavailableException('Cloudinary chưa được cấu hình');
    }
  }
}
