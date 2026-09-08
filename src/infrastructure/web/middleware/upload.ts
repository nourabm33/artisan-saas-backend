import multer from 'multer';
import { UploadFile } from '../../../application/ports/IMediaStorage';
import { ALLOWED_MEDIA_MIME_TYPES } from '../../../application/use-cases/media/MediaUseCases';
import { ValidationError } from '../../../domain/errors/ValidationError';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;

const storage = multer.memoryStorage();

/** `multipart/form-data` with one or more `files` fields. */
export const uploadFiles = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES_PER_UPLOAD },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MEDIA_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new ValidationError({ files: [`Unsupported file type ${file.mimetype}`] }));
  },
}).array('files', MAX_FILES_PER_UPLOAD);

export const toUploadFiles = (files: Express.Multer.File[] | undefined): UploadFile[] =>
  (files ?? []).map((f) => ({
    buffer: f.buffer,
    mimeType: f.mimetype,
    originalName: f.originalname,
  }));
