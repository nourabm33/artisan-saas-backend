import { ValidationError } from '../errors/ValidationError';

export class Money {
  private readonly amount: number;
  private readonly currency: string;

  constructor(amount: number, currency: string = 'EUR') {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError({ amount: ['Amount must be a non-negative number'] });
    }
    this.amount = Math.round(amount * 100) / 100;
    this.currency = currency;
  }

  get(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationError({ currency: ['Cannot operate on different currencies'] });
    }
  }
}
