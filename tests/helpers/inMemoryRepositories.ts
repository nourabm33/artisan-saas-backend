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

export interface InMemoryRepositories {
  userRepository: InMemoryUserRepository;
  organizationRepository: InMemoryOrganizationRepository;
  clientRepository: InMemoryClientRepository;
  serviceTemplateRepository: InMemoryServiceTemplateRepository;
  requestRepository: InMemoryRequestRepository;
  quoteRepository: InMemoryQuoteRepository;
}

export const createInMemoryRepositories = (): InMemoryRepositories => ({
  userRepository: new InMemoryUserRepository(),
  organizationRepository: new InMemoryOrganizationRepository(),
  clientRepository: new InMemoryClientRepository(),
  serviceTemplateRepository: new InMemoryServiceTemplateRepository(),
  requestRepository: new InMemoryRequestRepository(),
  quoteRepository: new InMemoryQuoteRepository(),
});
