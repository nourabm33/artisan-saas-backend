import { RequestStatus, ServiceRequest } from '../entities/ServiceRequest';

export interface RequestFilters {
  status?: RequestStatus;
  clientId?: string;
  limit?: number;
  offset?: number;
}

export interface IRequestRepository {
  findById(id: string): Promise<ServiceRequest | null>;
  findByOrgId(orgId: string, filters?: RequestFilters): Promise<ServiceRequest[]>;
  findByClientId(clientId: string): Promise<ServiceRequest[]>;
  save(request: ServiceRequest): Promise<ServiceRequest>;
  update(request: ServiceRequest): Promise<ServiceRequest>;
  delete(id: string): Promise<void>;
}
