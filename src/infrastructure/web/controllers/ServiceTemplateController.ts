import { Request, Response } from 'express';
import { CreateServiceTemplateBody } from '../../../application/dtos/RequestDtos';
import { CreateServiceTemplateUseCase } from '../../../application/use-cases/service-templates/CreateServiceTemplateUseCase';
import { ListServiceTemplatesUseCase } from '../../../application/use-cases/service-templates/ListServiceTemplatesUseCase';
import { AuthenticatedRequest } from '../middleware/authenticate';

export class ServiceTemplateController {
  constructor(
    private readonly listUseCase: ListServiceTemplatesUseCase,
    private readonly createUseCase: CreateServiceTemplateUseCase
  ) {}

  listPublic = async (req: Request, res: Response): Promise<void> => {
    const services = await this.listUseCase.executePublic(req.params.orgId);
    res.status(200).json({ services });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const services = await this.listUseCase.execute(auth.orgId);
    res.status(200).json({ services });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const service = await this.createUseCase.execute(
      auth.orgId,
      req.body as CreateServiceTemplateBody
    );
    res.status(201).json({ service });
  };
}
