import { Pool } from 'pg';
import { Media, MediaType, MediaUploader } from '../../../domain/entities/Media';
import { IMediaRepository } from '../../../domain/repositories/IMediaRepository';

interface MediaRow {
  id: string;
  request_id: string;
  url: string;
  type: MediaType;
  uploaded_by: MediaUploader;
  cloudinary_public_id: string | null;
  created_at: Date;
}

export class MediaRepository implements IMediaRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Media | null> {
    const result = await this.pool.query<MediaRow>('SELECT * FROM media WHERE id = $1', [id]);
    return result.rows[0] ? MediaRepository.toEntity(result.rows[0]) : null;
  }

  async findByRequestId(requestId: string): Promise<Media[]> {
    const result = await this.pool.query<MediaRow>(
      'SELECT * FROM media WHERE request_id = $1 ORDER BY created_at ASC',
      [requestId]
    );
    return result.rows.map(MediaRepository.toEntity);
  }

  async countByRequestId(requestId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM media WHERE request_id = $1',
      [requestId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async save(media: Media): Promise<Media> {
    const result = await this.pool.query<MediaRow>(
      `INSERT INTO media (id, request_id, url, type, uploaded_by, cloudinary_public_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        media.id,
        media.requestId,
        media.url,
        media.type,
        media.uploadedBy,
        media.storageId ?? null,
        media.createdAt,
      ]
    );
    return MediaRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM media WHERE id = $1', [id]);
  }

  private static toEntity(row: MediaRow): Media {
    return new Media({
      id: row.id,
      requestId: row.request_id,
      url: row.url,
      type: row.type,
      uploadedBy: row.uploaded_by,
      storageId: row.cloudinary_public_id ?? undefined,
      createdAt: row.created_at,
    });
  }
}
