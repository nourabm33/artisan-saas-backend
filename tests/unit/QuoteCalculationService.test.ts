import { QuoteCalculationService } from '@/application/services/QuoteCalculationService';
import { ValidationError } from '@/domain/errors/ValidationError';

describe('QuoteCalculationService', () => {
  const service = new QuoteCalculationService();

  it('computes base + labor, 22% IVA and total', () => {
    const q = service.calculateQuote({ basePrice: 45 }, 1);
    expect(q).toMatchObject({
      basePrice: 45,
      laborHours: 1,
      laborRate: 30,
      subtotal: 75,
      discount: 0,
      taxPercentage: 22,
      taxAmount: 16.5,
      total: 91.5,
    });
  });

  it('applies a percentage discount before tax', () => {
    const q = service.calculateQuote({ basePrice: 100 }, 0, 10);
    expect(q.subtotal).toBe(100);
    expect(q.discount).toBe(10);
    expect(q.taxAmount).toBe(19.8);
    expect(q.total).toBe(109.8);
  });

  it('rounds to cents', () => {
    const q = service.calculateQuote({ basePrice: 15 }, 0.5);
    expect(q.subtotal).toBe(30);
    expect(q.taxAmount).toBe(6.6);
    expect(q.total).toBe(36.6);
  });

  it('supports a custom labor rate and tax', () => {
    const q = new QuoteCalculationService({ laborRate: 50, taxPercentage: 10 }).calculateQuote(
      { basePrice: 10 },
      2
    );
    expect(q.subtotal).toBe(110);
    expect(q.total).toBe(121);
  });

  it('rejects invalid inputs', () => {
    expect(() => service.calculateQuote({ basePrice: 10 }, -1)).toThrow(ValidationError);
    expect(() => service.calculateQuote({ basePrice: 10 }, 1, 101)).toThrow(ValidationError);
  });

  it('formats an Italian quote summary', () => {
    const text = service.formatQuoteForDisplay(service.calculateQuote({ basePrice: 45 }, 1, 10));
    expect(text).toContain('Preventivo');
    expect(text).toContain('Subtotale: 75.00€');
    expect(text).toContain('Sconto: -7.50€');
    expect(text).toContain('IVA 22%: 14.85€');
    expect(text).toContain('TOTALE: 82.35€');
  });
});
