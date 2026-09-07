import { ServiceTemplate } from '../entities/ServiceTemplate';

export interface ServiceTemplateFilters {
  activeOnly?: boolean;
}

export interface IServiceTemplateRepository {
  findById(id: string): Promise<ServiceTemplate | null>;
  findByOrgId(orgId: string, filters?: ServiceTemplateFilters): Promise<ServiceTemplate[]>;
  findByTradeType(tradeType: string): Promise<ServiceTemplate[]>;
  save(template: ServiceTemplate): Promise<ServiceTemplate>;
  update(template: ServiceTemplate): Promise<ServiceTemplate>;
  delete(id: string): Promise<void>;
}
