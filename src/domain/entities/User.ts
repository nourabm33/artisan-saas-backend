import { randomUUID } from 'crypto';
import { Email } from '../value-objects/Email';
import { Phone } from '../value-objects/Phone';

export type UserRole = 'owner' | 'admin' | 'technician';

export interface CreateUserProps {
  id?: string;
  orgId: string;
  email: Email;
  phone?: Phone;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  readonly id: string;
  readonly orgId: string;
  readonly email: Email;
  readonly phone?: Phone;
  readonly firstName: string;
  readonly lastName: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly lastLoginAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateUserProps) {
    this.id = props.id ?? randomUUID();
    this.orgId = props.orgId;
    this.email = props.email;
    this.phone = props.phone;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.isActive = props.isActive ?? true;
    this.lastLoginAt = props.lastLoginAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  isOwner(): boolean {
    return this.role === 'owner';
  }

  withLastLogin(at: Date = new Date()): User {
    return new User({ ...this.toProps(), lastLoginAt: at, updatedAt: new Date() });
  }

  private toProps(): CreateUserProps {
    return {
      id: this.id,
      orgId: this.orgId,
      email: this.email,
      phone: this.phone,
      firstName: this.firstName,
      lastName: this.lastName,
      passwordHash: this.passwordHash,
      role: this.role,
      isActive: this.isActive,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static create(props: Omit<CreateUserProps, 'id' | 'createdAt' | 'updatedAt'>): User {
    const now = new Date();
    return new User({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }
}
