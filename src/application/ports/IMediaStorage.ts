export interface UploadFile {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface StoredFile {
  url: string;
  storageId: string;
}

export interface IMediaStorage {
  upload(file: UploadFile, folder: string): Promise<StoredFile>;
  delete(storageId: string): Promise<void>;
}
