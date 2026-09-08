import { Request, Response } from 'express';
import {
  DeleteRequestMediaUseCase,
  UploadRequestMediaUseCase,
} from '../../../application/use-cases/media/MediaUseCases';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { toUploadFiles } from '../middleware/upload';

export class MediaController {
  constructor(
    private readonly uploadRequestMediaUseCase: UploadRequestMediaUseCase,
    private readonly deleteRequestMediaUseCase: DeleteRequestMediaUseCase
  ) {}

  uploadPublic = async (req: Request, res: Response): Promise<void> => {
    const media = await this.uploadRequestMediaUseCase.execute(
      req.params.orgId,
      req.params.requestId,
      toUploadFiles(req.files as Express.Multer.File[] | undefined),
      'client'
    );
    res.status(201).json({ media });
  };

  upload = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const media = await this.uploadRequestMediaUseCase.execute(
      auth.orgId,
      req.params.id,
      toUploadFiles(req.files as Express.Multer.File[] | undefined),
      'artisan'
    );
    res.status(201).json({ media });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    await this.deleteRequestMediaUseCase.execute(auth.orgId, req.params.id, req.params.mediaId);
    res.status(204).send();
  };
}
