import { Organization } from '../entities/Organization';

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  save(organization: Organization): Promise<Organization>;
  update(organization: Organization): Promise<Organization>;
  delete(id: string): Promise<void>;
}
