import { Appointment } from '../../domain/entities/Appointment';
import { Quote } from '../../domain/entities/Quote';
import { ServiceRequest } from '../../domain/entities/ServiceRequest';
import { NotFoundError } from '../../domain/errors/NotFoundError';
import { IAppointmentRepository } from '../../domain/repositories/IAppointmentRepository';
import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { IRequestRepository } from '../../domain/repositories/IRequestRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { AppointmentSchedulingService } from './AppointmentSchedulingService';

export interface QuoteDecisionResult {
  quote: Quote;
  request: ServiceRequest;
  appointment: Appointment | null;
}

export interface QuoteAcceptanceRepositories {
  quoteRepository: IQuoteRepository;
  requestRepository: IRequestRepository;
  appointmentRepository: IAppointmentRepository;
  userRepository: IUserRepository;
}

/**
 * Single place where a quote decision is applied, whether it comes from the
 * artisan (dashboard) or the client (WhatsApp reply). Accepting a quote also
 * books the appointment and links it to the request.
 */
export class QuoteAcceptanceService {
  constructor(
    private readonly repos: QuoteAcceptanceRepositories,
    private readonly scheduling: AppointmentSchedulingService
  ) {}

  async accept(quote: Quote, request: ServiceRequest): Promise<QuoteDecisionResult> {
    const acceptedQuote = await this.repos.quoteRepository.update(quote.withStatus('accepted'));
    let acceptedRequest = await this.repos.requestRepository.update(request.withStatus('accepted'));

    let appointment = await this.repos.appointmentRepository.findByRequestId(request.id);
    if (!appointment || !appointment.isOpen) {
      const { start, end } = this.scheduling.schedule(request, acceptedQuote.laborHours);
      appointment = await this.repos.appointmentRepository.save(
        Appointment.create({
          requestId: request.id,
          orgId: request.orgId,
          assignedTo: acceptedQuote.createdBy,
          scheduledStart: start,
          scheduledEnd: end,
        })
      );
    }
    if (acceptedRequest.appointmentId !== appointment.id) {
      acceptedRequest = await this.repos.requestRepository.update(
        acceptedRequest.withAppointment(appointment.id)
      );
    }
    return { quote: acceptedQuote, request: acceptedRequest, appointment };
  }

  async reject(quote: Quote, request: ServiceRequest): Promise<QuoteDecisionResult> {
    const rejectedQuote = await this.repos.quoteRepository.update(quote.withStatus('rejected'));
    const rejectedRequest = await this.repos.requestRepository.update(
      request.withStatus('rejected')
    );
    const appointment = await this.repos.appointmentRepository.findByRequestId(request.id);
    let cancelled: Appointment | null = null;
    if (appointment?.isOpen) {
      cancelled = await this.repos.appointmentRepository.update(
        appointment.withStatus('cancelled')
      );
    }
    return { quote: rejectedQuote, request: rejectedRequest, appointment: cancelled };
  }

  /** Loads a quote and its request, enforcing org scope. */
  async load(orgId: string, quoteId: string): Promise<{ quote: Quote; request: ServiceRequest }> {
    const quote = await this.repos.quoteRepository.findById(quoteId);
    const request = quote ? await this.repos.requestRepository.findById(quote.requestId) : null;
    if (!quote || !request || request.orgId !== orgId) {
      throw new NotFoundError('Quote', quoteId);
    }
    return { quote, request };
  }
}
