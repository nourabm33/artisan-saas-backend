import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { RequestDetailDto } from '../../dtos/RequestDtos';
import { toClientDto, toQuoteDto, toRequestDto } from '../../mappers/RequestMappers';

export class GetRequestUseCase {
  constructor(
    private readonly requestRepository: IRequestRepository,
    private readonly clientRepository: IClientRepository,
    private readonly quoteRepository: IQuoteRepository
  ) {}

  /** Org-scoped: a request belonging to another organization is reported as not found. */
  async execute(orgId: string, requestId: string): Promise<RequestDetailDto> {
    const request = await this.requestRepository.findById(requestId);
    if (!request || request.orgId !== orgId) {
      throw new NotFoundError('Request', requestId);
    }
    const [client, quote] = await Promise.all([
      this.clientRepository.findById(request.clientId),
      this.quoteRepository.findByRequestId(request.id),
    ]);
    return {
      ...toRequestDto(request),
      client: client ? toClientDto(client) : null,
      quote: quote ? toQuoteDto(quote) : null,
    };
  }
}
