import { User } from '@/domain/entities/User';
import { Organization } from '@/domain/entities/Organization';
import { Client } from '@/domain/entities/Client';
import { ServiceTemplate } from '@/domain/entities/ServiceTemplate';
import { ServiceRequest } from '@/domain/entities/ServiceRequest';
import { Quote } from '@/domain/entities/Quote';
import { Phone } from '@/domain/value-objects/Phone';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IOrganizationRepository } from '@/domain/repositories/IOrganizationRepository';
import { IClientRepository } from '@/domain/repositories/IClientRepository';
import {
  IServiceTemplateRepository,
  ServiceTemplateFilters,
} from '@/domain/repositories/IServiceTemplateRepository';
import { IRequestRepository, RequestFilters } from '@/domain/repositories/IRequestRepository';
import { IQuoteRepository } from '@/domain/repositories/IQuoteRepository';
import { Appointment } from '@/domain/entities/Appointment';
import { Media } from '@/domain/entities/Media';
import { WhatsAppMessage } from '@/domain/entities/WhatsAppMessage';
import {
  AppointmentFilters,
  IAppointmentRepository,
} from '@/domain/repositories/IAppointmentRepository';
import { IMediaRepository } from '@/domain/repositories/IMediaRepository';
import { IWhatsAppMessageRepository } from '@/domain/repositories/IWhatsAppMessageRepository';
import { IWhatsAppGateway, WhatsAppSendResult } from '@/application/ports/IWhatsAppGateway';
import { IMediaStorage, StoredFile, UploadFile } from '@/application/ports/IMediaStorage';
import { ConflictError } from '@/domain/errors/ConflictError';

export class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.get() === normalized) return user;
    }
    return null;
  }

  async findByOrgId(orgId: string): Promise<User[]> {
    return [...this.users.values()].filter((u) => u.orgId === orgId);
  }

  async save(user: User): Promise<User> {
    if (await this.findByEmail(user.email.get())) {
      throw new ConflictError('Email already registered');
    }
    this.users.set(user.id, user);
    return user;
  }

  async update(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

export class InMemoryOrganizationRepository implements IOrganizationRepository {
  readonly organizations = new Map<string, Organization>();

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) ?? null;
  }

  async save(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);
    return organization;
  }

  async update(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);
    return organization;
  }

  async delete(id: string): Promise<void> {
    this.organizations.delete(id);
  }
}

export class InMemoryClientRepository implements IClientRepository {
  readonly clients = new Map<string, Client>();

  async findById(id: string): Promise<Client | null> {
    return this.clients.get(id) ?? null;
  }

  async findByPhone(orgId: string, phone: Phone): Promise<Client | null> {
    for (const client of this.clients.values()) {
      if (client.orgId === orgId && client.phone.equals(phone)) return client;
    }
    return null;
  }

  async findAllByPhone(phone: Phone): Promise<Client[]> {
    return [...this.clients.values()].filter((c) => c.phone.equals(phone));
  }

  async findByOrgId(orgId: string): Promise<Client[]> {
    return [...this.clients.values()].filter((c) => c.orgId === orgId);
  }

  async save(client: Client): Promise<Client> {
    if (await this.findByPhone(client.orgId, client.phone)) {
      throw new ConflictError('Client with this phone already exists');
    }
    this.clients.set(client.id, client);
    return client;
  }

  async update(client: Client): Promise<Client> {
    this.clients.set(client.id, client);
    return client;
  }

  async delete(id: string): Promise<void> {
    this.clients.delete(id);
  }
}

export class InMemoryServiceTemplateRepository implements IServiceTemplateRepository {
  readonly templates = new Map<string, ServiceTemplate>();

  async findById(id: string): Promise<ServiceTemplate | null> {
    return this.templates.get(id) ?? null;
  }

  async findByOrgId(
    orgId: string,
    filters: ServiceTemplateFilters = {}
  ): Promise<ServiceTemplate[]> {
    return [...this.templates.values()].filter(
      (t) => t.orgId === orgId && (!filters.activeOnly || t.isActive)
    );
  }

  async findByTradeType(tradeType: string): Promise<ServiceTemplate[]> {
    return [...this.templates.values()].filter((t) => t.tradeType === tradeType && t.isActive);
  }

  async save(template: ServiceTemplate): Promise<ServiceTemplate> {
    this.templates.set(template.id, template);
    return template;
  }

  async update(template: ServiceTemplate): Promise<ServiceTemplate> {
    this.templates.set(template.id, template);
    return template;
  }

  async delete(id: string): Promise<void> {
    this.templates.delete(id);
  }
}

export class InMemoryRequestRepository implements IRequestRepository {
  readonly requests = new Map<string, ServiceRequest>();

  async findById(id: string): Promise<ServiceRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async findByOrgId(orgId: string, filters: RequestFilters = {}): Promise<ServiceRequest[]> {
    return [...this.requests.values()]
      .filter(
        (r) =>
          r.orgId === orgId &&
          (!filters.status || r.status === filters.status) &&
          (!filters.clientId || r.clientId === filters.clientId)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50));
  }

  async findByClientId(clientId: string): Promise<ServiceRequest[]> {
    return [...this.requests.values()].filter((r) => r.clientId === clientId);
  }

  async save(request: ServiceRequest): Promise<ServiceRequest> {
    this.requests.set(request.id, request);
    return request;
  }

  async update(request: ServiceRequest): Promise<ServiceRequest> {
    this.requests.set(request.id, request);
    return request;
  }

  async delete(id: string): Promise<void> {
    this.requests.delete(id);
  }
}

export class InMemoryQuoteRepository implements IQuoteRepository {
  readonly quotes = new Map<string, Quote>();

  async findById(id: string): Promise<Quote | null> {
    return this.quotes.get(id) ?? null;
  }

  async findByRequestId(requestId: string): Promise<Quote | null> {
    for (const quote of this.quotes.values()) {
      if (quote.requestId === requestId) return quote;
    }
    return null;
  }

  async save(quote: Quote): Promise<Quote> {
    this.quotes.set(quote.id, quote);
    return quote;
  }

  async update(quote: Quote): Promise<Quote> {
    this.quotes.set(quote.id, quote);
    return quote;
  }

  async delete(id: string): Promise<void> {
    this.quotes.delete(id);
  }
}

export class InMemoryAppointmentRepository implements IAppointmentRepository {
  readonly appointments = new Map<string, Appointment>();

  async findById(id: string): Promise<Appointment | null> {
    return this.appointments.get(id) ?? null;
  }

  async findByRequestId(requestId: string): Promise<Appointment | null> {
    const matches = [...this.appointments.values()]
      .filter((a) => a.requestId === requestId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches[0] ?? null;
  }

  async findByOrgId(orgId: string, filters: AppointmentFilters = {}): Promise<Appointment[]> {
    return [...this.appointments.values()]
      .filter((a) => a.orgId === orgId)
      .filter((a) => !filters.status || a.status === filters.status)
      .filter((a) => !filters.assignedTo || a.assignedTo === filters.assignedTo)
      .filter((a) => !filters.from || a.scheduledStart >= filters.from)
      .filter((a) => !filters.to || a.scheduledStart < filters.to)
      .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
      .slice(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50));
  }

  async save(appointment: Appointment): Promise<Appointment> {
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async update(appointment: Appointment): Promise<Appointment> {
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async delete(id: string): Promise<void> {
    this.appointments.delete(id);
  }
}

export class InMemoryMediaRepository implements IMediaRepository {
  readonly media = new Map<string, Media>();

  async findById(id: string): Promise<Media | null> {
    return this.media.get(id) ?? null;
  }

  async findByRequestId(requestId: string): Promise<Media[]> {
    return [...this.media.values()].filter((m) => m.requestId === requestId);
  }

  async countByRequestId(requestId: string): Promise<number> {
    return (await this.findByRequestId(requestId)).length;
  }

  async save(media: Media): Promise<Media> {
    this.media.set(media.id, media);
    return media;
  }

  async delete(id: string): Promise<void> {
    this.media.delete(id);
  }
}

export class InMemoryWhatsAppMessageRepository implements IWhatsAppMessageRepository {
  readonly messages: WhatsAppMessage[] = [];

  async findByProviderMessageId(providerMessageId: string): Promise<WhatsAppMessage | null> {
    return this.messages.find((m) => m.providerMessageId === providerMessageId) ?? null;
  }

  async findByRequestId(requestId: string): Promise<WhatsAppMessage[]> {
    return this.messages.filter((m) => m.requestId === requestId);
  }

  async save(message: WhatsAppMessage): Promise<WhatsAppMessage> {
    this.messages.push(message);
    return message;
  }
}

export class FakeWhatsAppGateway implements IWhatsAppGateway {
  readonly sent: { to: string; body: string }[] = [];
  failNext = false;
  acceptWebhooks = true;

  async send(to: Phone, body: string): Promise<WhatsAppSendResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('twilio down');
    }
    this.sent.push({ to: to.toE164(), body });
    return { providerMessageId: `SM${this.sent.length}` };
  }

  verifyWebhook(): boolean {
    return this.acceptWebhooks;
  }
}

export class FakeMediaStorage implements IMediaStorage {
  readonly files = new Map<string, UploadFile>();

  async upload(file: UploadFile, folder: string): Promise<StoredFile> {
    const storageId = `${folder}/${this.files.size + 1}`;
    this.files.set(storageId, file);
    return { url: `https://cdn.test/${storageId}`, storageId };
  }

  async delete(storageId: string): Promise<void> {
    this.files.delete(storageId);
  }
}

export interface InMemoryRepositories {
  userRepository: InMemoryUserRepository;
  organizationRepository: InMemoryOrganizationRepository;
  clientRepository: InMemoryClientRepository;
  serviceTemplateRepository: InMemoryServiceTemplateRepository;
  requestRepository: InMemoryRequestRepository;
  quoteRepository: InMemoryQuoteRepository;
  appointmentRepository: InMemoryAppointmentRepository;
  mediaRepository: InMemoryMediaRepository;
  whatsAppMessageRepository: InMemoryWhatsAppMessageRepository;
  whatsAppGateway: FakeWhatsAppGateway;
  mediaStorage: FakeMediaStorage;
}

export const createInMemoryRepositories = (): InMemoryRepositories => ({
  userRepository: new InMemoryUserRepository(),
  organizationRepository: new InMemoryOrganizationRepository(),
  clientRepository: new InMemoryClientRepository(),
  serviceTemplateRepository: new InMemoryServiceTemplateRepository(),
  requestRepository: new InMemoryRequestRepository(),
  quoteRepository: new InMemoryQuoteRepository(),
  appointmentRepository: new InMemoryAppointmentRepository(),
  mediaRepository: new InMemoryMediaRepository(),
  whatsAppMessageRepository: new InMemoryWhatsAppMessageRepository(),
  whatsAppGateway: new FakeWhatsAppGateway(),
  mediaStorage: new FakeMediaStorage(),
});

export const testConfig = {
  corsOrigin: '*' as const,
  jwtSecret: 'integration-test-secret',
  jwtAccessExpiry: '15m',
  jwtRefreshExpiry: '7d',
  appUrl: 'http://localhost:3000',
};
