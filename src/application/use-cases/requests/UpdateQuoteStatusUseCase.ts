import { QuoteStatus } from '../../../domain/entities/Quote';
import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { QuoteDto } from '../../dtos/RequestDtos';
import { toQuoteDto } from '../../mappers/RequestMappers';

/**
 * Moves a quote through draft -> sent -> accepted | rejected and keeps the
 * parent request's status in sync (accepted/rejected propagate to the request).
 */
export class UpdateQuoteStatusUseCase {
  constructor(
    private readonly quoteRepository: IQuoteRepository,
    private readonly requestRepository: IRequestRepository
  ) {}

  async execute(orgId: string, quoteId: string, status: QuoteStatus): Promise<QuoteDto> {
    const quote = await this.quoteRepository.findById(quoteId);
    const request = quote ? await this.requestRepository.findById(quote.requestId) : null;
    if (!quote || !request || request.orgId !== orgId) {
      throw new NotFoundError('Quote', quoteId);
    }

    const updated = await this.quoteRepository.update(quote.withStatus(status));
    if (status === 'accepted' || status === 'rejected') {
      await this.requestRepository.update(request.withStatus(status));
    }
    return toQuoteDto(updated);
  }
}
