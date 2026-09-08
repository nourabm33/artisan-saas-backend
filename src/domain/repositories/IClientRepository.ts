import { Client } from '../entities/Client';
import { Phone } from '../value-objects/Phone';

export interface IClientRepository {
  findById(id: string): Promise<Client | null>;
  findByPhone(orgId: string, phone: Phone): Promise<Client | null>;
  /** Same phone may be registered with several organizations. */
  findAllByPhone(phone: Phone): Promise<Client[]>;
  findByOrgId(orgId: string): Promise<Client[]>;
  save(client: Client): Promise<Client>;
  update(client: Client): Promise<Client>;
  delete(id: string): Promise<void>;
}
