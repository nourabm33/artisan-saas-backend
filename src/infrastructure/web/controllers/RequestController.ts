import { Request, Response } from 'express';
import {
  ListRequestsQuery,
  SubmitRequestBody,
  UpdateQuoteStatusBody,
} from '../../../application/dtos/RequestDtos';
import { GetRequestUseCase } from '../../../application/use-cases/requests/GetRequestUseCase';
import { ListRequestsUseCase } from '../../../application/use-cases/requests/ListRequestsUseCase';
import { SubmitRequestUseCase } from '../../../application/use-cases/requests/SubmitRequestUseCase';
import { UpdateQuoteStatusUseCase } from '../../../application/use-cases/requests/UpdateQuoteStatusUseCase';
import { AuthenticatedRequest } from '../middleware/authenticate';

export class RequestController {
  constructor(
    private readonly submitRequestUseCase: SubmitRequestUseCase,
    private readonly listRequestsUseCase: ListRequestsUseCase,
    private readonly getRequestUseCase: GetRequestUseCase,
    private readonly updateQuoteStatusUseCase: UpdateQuoteStatusUseCase
  ) {}

  submit = async (req: Request, res: Response): Promise<void> => {
    const result = await this.submitRequestUseCase.execute({
      orgId: req.params.orgId,
      ...(req.body as SubmitRequestBody),
    });
    res.status(201).json(result);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const query = req.query as unknown as ListRequestsQuery;
    const requests = await this.listRequestsUseCase.execute(auth.orgId, query);
    res.status(200).json({ requests, limit: query.limit, offset: query.offset });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const request = await this.getRequestUseCase.execute(auth.orgId, req.params.id);
    res.status(200).json({ request });
  };

  updateQuoteStatus = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const { status } = req.body as UpdateQuoteStatusBody;
    const quote = await this.updateQuoteStatusUseCase.execute(auth.orgId, req.params.id, status);
    res.status(200).json({ quote });
  };
}
