import { Quote } from '../entities/Quote';

export interface IQuoteRepository {
  findById(id: string): Promise<Quote | null>;
  findByRequestId(requestId: string): Promise<Quote | null>;
  save(quote: Quote): Promise<Quote>;
  update(quote: Quote): Promise<Quote>;
  delete(id: string): Promise<void>;
}
