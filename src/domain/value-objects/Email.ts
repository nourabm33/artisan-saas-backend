import { ValidationError } from '../errors/ValidationError';

export class Email {
  private readonly value: string;

  constructor(email: string) {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!Email.isValid(normalized)) {
      throw new ValidationError({ email: [`Invalid email: ${email}`] });
    }
    this.value = normalized;
  }

  static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  get(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
