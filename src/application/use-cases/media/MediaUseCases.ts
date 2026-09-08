import { Media, MediaUploader } from '../../../domain/entities/Media';
import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { ValidationError } from '../../../domain/errors/ValidationError';
import { IMediaRepository } from '../../../domain/repositories/IMediaRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { MediaDto } from '../../dtos/RequestDtos';
import { toMediaDto } from '../../mappers/RequestMappers';
import { IMediaStorage, UploadFile } from '../../ports/IMediaStorage';

export interface MediaRepositories {
  mediaRepository: IMediaRepository;
  requestRepository: IRequestRepository;
}

export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'video/mp4',
  'application/pdf',
];
export const MAX_MEDIA_PER_REQUEST = 10;

/**
 * Attaches files to a request. Public callers (the client form) must know
 * both the org and the request id; artisans are scoped by their token.
 * Files are uploaded first so a storage failure leaves no dangling rows;
 * rows that fail to persist are removed from storage again.
 */
export class UploadRequestMediaUseCase {
  constructor(
    private readonly repos: MediaRepositories,
    private readonly storage: IMediaStorage
  ) {}

  async execute(
    orgId: string,
    requestId: string,
    files: UploadFile[],
    uploadedBy: MediaUploader
  ): Promise<MediaDto[]> {
    const request = await this.repos.requestRepository.findById(requestId);
    if (!request || request.orgId !== orgId) {
      throw new NotFoundError('Request', requestId);
    }
    if (files.length === 0) {
      throw new ValidationError({ files: ['At least one file is required'] });
    }
    const rejected = files.filter((f) => !ALLOWED_MEDIA_MIME_TYPES.includes(f.mimeType));
    if (rejected.length > 0) {
      throw new ValidationError({
        files: rejected.map((f) => `Unsupported file type ${f.mimeType} (${f.originalName})`),
      });
    }
    const existing = await this.repos.mediaRepository.countByRequestId(requestId);
    if (existing + files.length > MAX_MEDIA_PER_REQUEST) {
      throw new ValidationError({
        files: [`A request can have at most ${MAX_MEDIA_PER_REQUEST} attachments`],
      });
    }

    const saved: Media[] = [];
    for (const file of files) {
      const stored = await this.storage.upload(file, `requests/${orgId}/${requestId}`);
      try {
        saved.push(
          await this.repos.mediaRepository.save(
            Media.create({
              requestId,
              url: stored.url,
              type: Media.typeFromMime(file.mimeType),
              uploadedBy,
              storageId: stored.storageId,
            })
          )
        );
      } catch (err) {
        await this.storage.delete(stored.storageId).catch(() => undefined);
        throw err;
      }
    }
    return saved.map(toMediaDto);
  }
}

export class DeleteRequestMediaUseCase {
  constructor(
    private readonly repos: MediaRepositories,
    private readonly storage: IMediaStorage
  ) {}

  async execute(orgId: string, requestId: string, mediaId: string): Promise<void> {
    const request = await this.repos.requestRepository.findById(requestId);
    if (!request || request.orgId !== orgId) {
      throw new NotFoundError('Request', requestId);
    }
    const media = await this.repos.mediaRepository.findById(mediaId);
    if (!media || media.requestId !== requestId) {
      throw new NotFoundError('Media', mediaId);
    }
    await this.repos.mediaRepository.delete(media.id);
    if (media.storageId) {
      await this.storage.delete(media.storageId).catch(() => undefined);
    }
  }
}
