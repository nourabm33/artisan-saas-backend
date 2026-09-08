import { QuoteStatus } from '../../../domain/entities/Quote';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { QuoteDto } from '../../dtos/RequestDtos';
import { toQuoteDto } from '../../mappers/RequestMappers';
import { QuoteAcceptanceService } from '../../services/QuoteAcceptanceService';

/**
 * Moves a quote through draft -> sent -> accepted | rejected. Accepting books
 * the appointment and rejecting cancels it (see QuoteAcceptanceService).
 */
export class UpdateQuoteStatusUseCase {
  constructor(
    private readonly quoteRepository: IQuoteRepository,
    private readonly acceptance: QuoteAcceptanceService
  ) {}

  async execute(orgId: string, quoteId: string, status: QuoteStatus): Promise<QuoteDto> {
    const { quote, request } = await this.acceptance.load(orgId, quoteId);
    if (status === 'accepted') {
      return toQuoteDto((await this.acceptance.accept(quote, request)).quote);
    }
    if (status === 'rejected') {
      return toQuoteDto((await this.acceptance.reject(quote, request)).quote);
    }
    const updated = await this.quoteRepository.update(quote.withStatus(status));
    return toQuoteDto(updated);
  }
}
