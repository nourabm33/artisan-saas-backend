import { User } from '@/domain/entities/User';
import { Organization } from '@/domain/entities/Organization';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IOrganizationRepository } from '@/domain/repositories/IOrganizationRepository';
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
