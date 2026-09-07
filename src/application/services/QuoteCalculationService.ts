import { ServiceTemplate } from '../../domain/entities/ServiceTemplate';
import { ValidationError } from '../../domain/errors/ValidationError';

export interface QuoteBreakdown {
  basePrice: number;
  laborHours: number;
  laborRate: number;
  subtotal: number;
  taxPercentage: number;
  /** Absolute discount in EUR (derived from the percentage passed in). */
  discount: number;
  taxAmount: number;
  total: number;
}

export interface QuoteCalculationOptions {
  /** Hourly labor rate in EUR. */
  laborRate?: number;
  /** VAT percentage (Italian IVA defaults to 22%). */
  taxPercentage?: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export class QuoteCalculationService {
  static readonly DEFAULT_LABOR_RATE = 30;
  static readonly DEFAULT_TAX_PERCENTAGE = 22;

  private readonly laborRate: number;
  private readonly taxPercentage: number;

  constructor(options: QuoteCalculationOptions = {}) {
    this.laborRate = options.laborRate ?? QuoteCalculationService.DEFAULT_LABOR_RATE;
    this.taxPercentage = options.taxPercentage ?? QuoteCalculationService.DEFAULT_TAX_PERCENTAGE;
  }

  calculateQuote(
    serviceTemplate: Pick<ServiceTemplate, 'basePrice'>,
    laborHours: number = 1,
    discountPercentage: number = 0
  ): QuoteBreakdown {
    if (!Number.isFinite(laborHours) || laborHours < 0) {
      throw new ValidationError({ laborHours: ['Labor hours must be a non-negative number'] });
    }
    if (
      !Number.isFinite(discountPercentage) ||
      discountPercentage < 0 ||
      discountPercentage > 100
    ) {
      throw new ValidationError({ discount: ['Discount must be between 0 and 100'] });
    }

    const subtotal = round2(serviceTemplate.basePrice + laborHours * this.laborRate);
    const discount = round2((subtotal * discountPercentage) / 100);
    const taxableAmount = round2(subtotal - discount);
    const taxAmount = round2((taxableAmount * this.taxPercentage) / 100);
    const total = round2(taxableAmount + taxAmount);

    return {
      basePrice: round2(serviceTemplate.basePrice),
      laborHours,
      laborRate: this.laborRate,
      subtotal,
      taxPercentage: this.taxPercentage,
      discount,
      taxAmount,
      total,
    };
  }

  formatQuoteForDisplay(quote: QuoteBreakdown): string {
    const eur = (n: number): string => `${n.toFixed(2)}€`;
    const lines = [
      'Preventivo',
      `${eur(quote.basePrice)} (base)`,
      `${quote.laborHours}h × ${eur(quote.laborRate)} = ${eur(quote.laborHours * quote.laborRate)}`,
      '─────────────────',
      `Subtotale: ${eur(quote.subtotal)}`,
    ];
    if (quote.discount > 0) lines.push(`Sconto: -${eur(quote.discount)}`);
    lines.push(
      `IVA ${quote.taxPercentage}%: ${eur(quote.taxAmount)}`,
      '─────────────────',
      `TOTALE: ${eur(quote.total)}`
    );
    return lines.join('\n');
  }
}
