import { Request, Response } from 'express';
import { UpdateQuoteBody, UpdateQuoteStatusBody } from '../../../application/dtos/RequestDtos';
import { UpdateQuoteStatusUseCase } from '../../../application/use-cases/requests/UpdateQuoteStatusUseCase';
import { GetQuoteUseCase } from '../../../application/use-cases/quotes/GetQuoteUseCase';
import { SendQuoteUseCase } from '../../../application/use-cases/quotes/SendQuoteUseCase';
import { UpdateQuoteUseCase } from '../../../application/use-cases/quotes/UpdateQuoteUseCase';
import { AuthenticatedRequest } from '../middleware/authenticate';

export class QuoteController {
  constructor(
    private readonly getQuoteUseCase: GetQuoteUseCase,
    private readonly updateQuoteUseCase: UpdateQuoteUseCase,
    private readonly updateQuoteStatusUseCase: UpdateQuoteStatusUseCase,
    private readonly sendQuoteUseCase: SendQuoteUseCase
  ) {}

  get = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const quote = await this.getQuoteUseCase.execute(auth.orgId, req.params.id);
    res.status(200).json({ quote });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const quote = await this.updateQuoteUseCase.execute(
      auth.orgId,
      req.params.id,
      req.body as UpdateQuoteBody
    );
    res.status(200).json({ quote });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const { status } = req.body as UpdateQuoteStatusBody;
    const quote = await this.updateQuoteStatusUseCase.execute(auth.orgId, req.params.id, status);
    res.status(200).json({ quote });
  };

  send = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const result = await this.sendQuoteUseCase.execute(auth.orgId, req.params.id);
    res.status(200).json(result);
  };
}
