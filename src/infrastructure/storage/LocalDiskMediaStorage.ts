import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { IMediaStorage, StoredFile, UploadFile } from '../../application/ports/IMediaStorage';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

/**
 * Development stand-in for Cloudinary: files land under `rootDir` and are
 * served by Express at `${publicBaseUrl}/<storageId>`.
 */
export class LocalDiskMediaStorage implements IMediaStorage {
  constructor(
    private readonly rootDir: string,
    private readonly publicBaseUrl: string
  ) {}

  async upload(file: UploadFile, folder: string): Promise<StoredFile> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const ext = EXTENSION_BY_MIME[file.mimeType] ?? 'bin';
    const storageId = path.posix.join(safeFolder, `${randomUUID()}.${ext}`);
    const target = path.join(this.rootDir, ...storageId.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.buffer);
    return { url: `${this.publicBaseUrl}/${storageId}`, storageId };
  }

  async delete(storageId: string): Promise<void> {
    const target = path.join(this.rootDir, ...storageId.split('/'));
    if (!target.startsWith(path.resolve(this.rootDir))) return;
    await fs.rm(target, { force: true });
  }
}
