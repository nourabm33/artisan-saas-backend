import { ValidationError } from '../errors/ValidationError';

/**
 * Italian phone number. Accepts national (9-10 digits) or international
 * (+39 / 0039 prefixed) input; stored as digits only, without country code.
 */
export class Phone {
  private static readonly COUNTRY_CODE = '39';
  private readonly value: string;

  constructor(phone: string) {
    const normalized = Phone.normalize(phone ?? '');
    if (!Phone.isValid(normalized)) {
      throw new ValidationError({ phone: [`Invalid phone: ${phone}`] });
    }
    this.value = normalized;
  }

  private static normalize(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }
    if (digits.length >= 11 && digits.startsWith(Phone.COUNTRY_CODE)) {
      digits = digits.slice(Phone.COUNTRY_CODE.length);
    }
    return digits;
  }

  private static isValid(national: string): boolean {
    return /^\d{9,10}$/.test(national);
  }

  get(): string {
    return this.value;
  }

  toE164(): string {
    return `+${Phone.COUNTRY_CODE}${this.value}`;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.toE164();
  }
}
