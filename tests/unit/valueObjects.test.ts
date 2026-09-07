import { Email, Money, Phone } from '@/domain/value-objects';
import { ValidationError } from '@/domain/errors';

describe('Email', () => {
  it('normalizes to lowercase and trims', () => {
    expect(new Email('  Mario@Example.COM ').get()).toBe('mario@example.com');
  });

  it('rejects invalid emails', () => {
    for (const bad of ['', 'mario', 'mario@', '@example.com', 'a b@c.d']) {
      expect(() => new Email(bad)).toThrow(ValidationError);
    }
  });

  it('compares by value', () => {
    expect(new Email('a@b.co').equals(new Email('A@B.CO'))).toBe(true);
  });
});

describe('Phone', () => {
  it.each([
    ['3331234567', '+393331234567'],
    ['+39 333 123 4567', '+393331234567'],
    ['0039 333-123-4567', '+393331234567'],
    ['+39123456789', '+39123456789'],
    ['06 1234567', '+39061234567'],
  ])('normalizes %s to %s', (input, e164) => {
    expect(new Phone(input).toE164()).toBe(e164);
  });

  it('rejects numbers that are too short or too long', () => {
    expect(() => new Phone('12345')).toThrow(ValidationError);
    expect(() => new Phone('+39 333 1234 5678 9')).toThrow(ValidationError);
    expect(() => new Phone('')).toThrow(ValidationError);
  });

  it('round-trips through E.164', () => {
    const phone = new Phone('333 123 4567');
    expect(new Phone(phone.toE164()).equals(phone)).toBe(true);
  });
});

describe('Money', () => {
  it('rounds to cents', () => {
    expect(new Money(10.005).get()).toBe(10.01);
    expect(new Money(1.1).add(new Money(2.2)).get()).toBe(3.3);
  });

  it('rejects negative and non-finite amounts', () => {
    expect(() => new Money(-1)).toThrow(ValidationError);
    expect(() => new Money(NaN)).toThrow(ValidationError);
  });

  it('refuses mixed currencies', () => {
    expect(() => new Money(1).add(new Money(1, 'USD'))).toThrow(ValidationError);
  });

  it('multiplies, subtracts and formats', () => {
    expect(new Money(40).multiply(1.22).toString()).toBe('48.80 EUR');
    expect(new Money(50).subtract(new Money(20)).equals(new Money(30))).toBe(true);
  });
});
