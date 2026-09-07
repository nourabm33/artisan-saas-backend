import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';
import { IServiceTemplateRepository } from '../../../domain/repositories/IServiceTemplateRepository';
import { ServiceTemplateDto } from '../../dtos/RequestDtos';
import { toServiceTemplateDto } from '../../mappers/RequestMappers';

export class ListServiceTemplatesUseCase {
  constructor(
    private readonly serviceTemplateRepository: IServiceTemplateRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  /** Public catalogue: only active templates, 404 if the org does not exist. */
  async executePublic(orgId: string): Promise<ServiceTemplateDto[]> {
    if (!(await this.organizationRepository.findById(orgId))) {
      throw new NotFoundError('Organization', orgId);
    }
    const templates = await this.serviceTemplateRepository.findByOrgId(orgId, {
      activeOnly: true,
    });
    return templates.map(toServiceTemplateDto);
  }

  async execute(orgId: string): Promise<ServiceTemplateDto[]> {
    const templates = await this.serviceTemplateRepository.findByOrgId(orgId);
    return templates.map(toServiceTemplateDto);
  }
}
