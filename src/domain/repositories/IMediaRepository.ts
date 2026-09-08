import { Media } from '../entities/Media';

export interface IMediaRepository {
  findById(id: string): Promise<Media | null>;
  findByRequestId(requestId: string): Promise<Media[]>;
  countByRequestId(requestId: string): Promise<number>;
  save(media: Media): Promise<Media>;
  delete(id: string): Promise<void>;
}
