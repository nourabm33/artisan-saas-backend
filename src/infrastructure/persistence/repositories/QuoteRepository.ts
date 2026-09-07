import { Pool } from 'pg';
import { Quote, QuoteStatus } from '../../../domain/entities/Quote';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';

interface QuoteRow {
  id: string;
  request_id: string;
  base_price: string;
  labor_hours: string;
  labor_rate: string;
  subtotal: string | null;
  tax_percentage: string | null;
  tax_amount: string | null;
  discount: string | null;
  total: string;
  notes: string | null;
  status: QuoteStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class QuoteRepository implements IQuoteRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Quote | null> {
    const result = await this.pool.query<QuoteRow>('SELECT * FROM quotes WHERE id = $1', [id]);
    return result.rows[0] ? QuoteRepository.toEntity(result.rows[0]) : null;
  }

  async findByRequestId(requestId: string): Promise<Quote | null> {
    const result = await this.pool.query<QuoteRow>(
      'SELECT * FROM quotes WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1',
      [requestId]
    );
    return result.rows[0] ? QuoteRepository.toEntity(result.rows[0]) : null;
  }

  async save(quote: Quote): Promise<Quote> {
    const query = `
      INSERT INTO quotes (id, request_id, base_price, labor_hours, labor_rate, subtotal, tax_percentage, tax_amount, discount, total, notes, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const result = await this.pool.query<QuoteRow>(query, [
      quote.id,
      quote.requestId,
      quote.basePrice,
      quote.laborHours,
      quote.laborRate,
      quote.subtotal,
      quote.taxPercentage,
      quote.taxAmount,
      quote.discount,
      quote.total,
      quote.notes ?? null,
      quote.status,
      quote.createdBy,
      quote.createdAt,
      quote.updatedAt,
    ]);
    return QuoteRepository.toEntity(result.rows[0]);
  }

  async update(quote: Quote): Promise<Quote> {
    const query = `
      UPDATE quotes SET base_price = $2, labor_hours = $3, labor_rate = $4, subtotal = $5, tax_percentage = $6,
        tax_amount = $7, discount = $8, total = $9, notes = $10, status = $11, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<QuoteRow>(query, [
      quote.id,
      quote.basePrice,
      quote.laborHours,
      quote.laborRate,
      quote.subtotal,
      quote.taxPercentage,
      quote.taxAmount,
      quote.discount,
      quote.total,
      quote.notes ?? null,
      quote.status,
    ]);
    return QuoteRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM quotes WHERE id = $1', [id]);
  }

  private static toEntity(row: QuoteRow): Quote {
    return new Quote({
      id: row.id,
      requestId: row.request_id,
      basePrice: Number(row.base_price),
      laborHours: Number(row.labor_hours),
      laborRate: Number(row.labor_rate),
      subtotal: Number(row.subtotal ?? 0),
      taxPercentage: Number(row.tax_percentage ?? 0),
      taxAmount: Number(row.tax_amount ?? 0),
      discount: Number(row.discount ?? 0),
      total: Number(row.total),
      notes: row.notes ?? undefined,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
