import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IAppointmentRepository } from '../../../domain/repositories/IAppointmentRepository';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IMediaRepository } from '../../../domain/repositories/IMediaRepository';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { IWhatsAppMessageRepository } from '../../../domain/repositories/IWhatsAppMessageRepository';
import { RequestDetailDto } from '../../dtos/RequestDtos';
import {
  toAppointmentDto,
  toClientDto,
  toMediaDto,
  toQuoteDto,
  toRequestDto,
  toWhatsAppMessageDto,
} from '../../mappers/RequestMappers';

export interface GetRequestRepositories {
  requestRepository: IRequestRepository;
  clientRepository: IClientRepository;
  quoteRepository: IQuoteRepository;
  appointmentRepository: IAppointmentRepository;
  mediaRepository: IMediaRepository;
  whatsAppMessageRepository: IWhatsAppMessageRepository;
}

export class GetRequestUseCase {
  constructor(private readonly repos: GetRequestRepositories) {}

  /** Org-scoped: a request belonging to another organization is reported as not found. */
  async execute(orgId: string, requestId: string): Promise<RequestDetailDto> {
    const request = await this.repos.requestRepository.findById(requestId);
    if (!request || request.orgId !== orgId) {
      throw new NotFoundError('Request', requestId);
    }
    const [client, quote, appointment, media, messages] = await Promise.all([
      this.repos.clientRepository.findById(request.clientId),
      this.repos.quoteRepository.findByRequestId(request.id),
      this.repos.appointmentRepository.findByRequestId(request.id),
      this.repos.mediaRepository.findByRequestId(request.id),
      this.repos.whatsAppMessageRepository.findByRequestId(request.id),
    ]);
    return {
      ...toRequestDto(request),
      client: client ? toClientDto(client) : null,
      quote: quote ? toQuoteDto(quote) : null,
      appointment: appointment ? toAppointmentDto(appointment) : null,
      media: media.map(toMediaDto),
      messages: messages.map(toWhatsAppMessageDto),
    };
  }
}
