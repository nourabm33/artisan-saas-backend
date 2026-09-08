import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { IMediaStorage, StoredFile, UploadFile } from '../../application/ports/IMediaStorage';
import { ExternalServiceError } from '../../domain/errors/ExternalServiceError';
import { CloudinaryConfig } from '../../config';

export class CloudinaryMediaStorage implements IMediaStorage {
  constructor(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async upload(file: UploadFile, folder: string): Promise<StoredFile> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, response) => {
          if (error || !response) {
            reject(new ExternalServiceError('Cloudinary', error?.message));
            return;
          }
          resolve(response);
        }
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, storageId: result.public_id };
  }

  async delete(storageId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(storageId, { resource_type: 'auto' });
    } catch (err) {
      throw new ExternalServiceError('Cloudinary', err instanceof Error ? err.message : undefined);
    }
  }
}
