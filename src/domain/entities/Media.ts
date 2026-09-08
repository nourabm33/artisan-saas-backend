import { randomUUID } from 'crypto';

export const MEDIA_TYPES = ['image', 'video', 'document'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_UPLOADERS = ['client', 'artisan'] as const;
export type MediaUploader = (typeof MEDIA_UPLOADERS)[number];

export interface CreateMediaProps {
  id?: string;
  requestId: string;
  url: string;
  type: MediaType;
  uploadedBy: MediaUploader;
  storageId?: string;
  createdAt?: Date;
}

/** A file attached to a request (photo of the tyre, damage, etc.). */
export class Media {
  readonly id: string;
  readonly requestId: string;
  readonly url: string;
  readonly type: MediaType;
  readonly uploadedBy: MediaUploader;
  /** Provider-side identifier (Cloudinary public_id) used to delete the asset. */
  readonly storageId?: string;
  readonly createdAt: Date;

  constructor(props: CreateMediaProps) {
    this.id = props.id ?? randomUUID();
    this.requestId = props.requestId;
    this.url = props.url;
    this.type = props.type;
    this.uploadedBy = props.uploadedBy;
    this.storageId = props.storageId;
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: Omit<CreateMediaProps, 'id' | 'createdAt'>): Media {
    return new Media({ ...props, id: randomUUID(), createdAt: new Date() });
  }

  static typeFromMime(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }
}
