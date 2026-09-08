import { QuoteDto } from '../../dtos/RequestDtos';
import { toQuoteDto } from '../../mappers/RequestMappers';
import { QuoteAcceptanceService } from '../../services/QuoteAcceptanceService';

export class GetQuoteUseCase {
  constructor(private readonly acceptance: QuoteAcceptanceService) {}

  async execute(orgId: string, quoteId: string): Promise<QuoteDto> {
    const { quote } = await this.acceptance.load(orgId, quoteId);
    return toQuoteDto(quote);
  }
}
