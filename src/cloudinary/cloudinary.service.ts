import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryUploadResult {
  key: CloudinaryImageKey;
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
}

export enum CloudinaryImageKey {
  ShopLogo = 'shop-logo',
  ShopBanner = 'shop-banner',
  ProductImage = 'product-image',
  UserAvatar = 'user-avatar',
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function isAllowedImageMimeType(mimetype: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimetype);
}

export interface UploadImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class CloudinaryService {
  constructor(configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadImage(
    file: UploadImageFile,
    key: CloudinaryImageKey,
  ): Promise<CloudinaryUploadResult> {
    if (!isAllowedImageMimeType(file.mimetype) || !this.matchesImageSignature(file)) {
      throw new BadRequestException(
        'Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF đúng định dạng.',
      );
    }

    return this.uploadValidatedImage(file, key);
  }

  async deleteImage(publicId: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: 'image', invalidate: true },
        (error, result) => {
          if (error || (result?.result !== 'ok' && result?.result !== 'not found')) {
            reject(error ?? new Error('Cloudinary không thể xóa ảnh đã upload.'));
            return;
          }

          resolve();
        },
      );
    });
  }

  private async uploadValidatedImage(
    file: UploadImageFile,
    key: CloudinaryImageKey,
  ): Promise<CloudinaryUploadResult> {
    try {
      return await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: `ecommerce/${key}`,
            resource_type: 'image',
          },
          (error, result) => {
            if (error || !result) {
              reject(error ?? new Error('Cloudinary không trả về kết quả upload.'));
              return;
            }

            resolve({
              key,
              public_id: result.public_id,
              secure_url: result.secure_url,
              format: result.format,
              resource_type: result.resource_type,
              bytes: result.bytes,
            });
          },
        );

        upload.end(file.buffer);
      });
    } catch {
      throw new InternalServerErrorException('Không thể tải ảnh lên Cloudinary.');
    }
  }

  private matchesImageSignature(file: UploadImageFile): boolean {
    const bytes = file.buffer;

    switch (file.mimetype) {
      case 'image/jpeg':
        return (
          bytes.length >= 3 &&
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes[2] === 0xff
        );
      case 'image/png':
        return (
          bytes.length >= 8 &&
          bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        );
      case 'image/webp':
        return (
          bytes.length >= 12 &&
          bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP'
        );
      case 'image/gif':
        return (
          bytes.length >= 6 &&
          ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))
        );
      default:
        return false;
    }
  }
}
