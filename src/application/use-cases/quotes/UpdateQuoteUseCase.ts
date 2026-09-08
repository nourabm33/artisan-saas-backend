import { Quote } from '../../../domain/entities/Quote';
import { ValidationError } from '../../../domain/errors/ValidationError';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { QuoteDto, UpdateQuoteBody } from '../../dtos/RequestDtos';
import { toQuoteDto } from '../../mappers/RequestMappers';
import { QuoteAcceptanceService } from '../../services/QuoteAcceptanceService';
import { QuoteCalculationService } from '../../services/QuoteCalculationService';

/**
 * Lets the artisan adjust labor hours / discount / notes before the client
 * decides. Amounts are recomputed; the quote keeps its current status.
 */
export class UpdateQuoteUseCase {
  constructor(
    private readonly quoteRepository: IQuoteRepository,
    private readonly acceptance: QuoteAcceptanceService,
    private readonly quoteCalculation: QuoteCalculationService
  ) {}

  async execute(orgId: string, quoteId: string, body: UpdateQuoteBody): Promise<QuoteDto> {
    const { quote } = await this.acceptance.load(orgId, quoteId);
    if (quote.status === 'accepted' || quote.status === 'rejected') {
      throw new ValidationError({ status: [`Cannot edit a ${quote.status} quote`] });
    }

    const currentDiscountPct = quote.subtotal > 0 ? (quote.discount / quote.subtotal) * 100 : 0;
    const breakdown = this.quoteCalculation.calculateQuote(
      { basePrice: quote.basePrice },
      body.laborHours ?? quote.laborHours,
      body.discountPercentage ?? currentDiscountPct
    );

    const updated = await this.quoteRepository.update(
      new Quote({
        ...quote,
        ...breakdown,
        notes: body.notes === undefined ? quote.notes : body.notes || undefined,
        updatedAt: new Date(),
      })
    );
    return toQuoteDto(updated);
  }
}
