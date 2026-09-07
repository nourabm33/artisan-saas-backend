import { ServiceTemplate } from '../../../domain/entities/ServiceTemplate';
import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';
import { IServiceTemplateRepository } from '../../../domain/repositories/IServiceTemplateRepository';
import { CreateServiceTemplateBody, ServiceTemplateDto } from '../../dtos/RequestDtos';
import { toServiceTemplateDto } from '../../mappers/RequestMappers';

export class CreateServiceTemplateUseCase {
  constructor(
    private readonly serviceTemplateRepository: IServiceTemplateRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(orgId: string, body: CreateServiceTemplateBody): Promise<ServiceTemplateDto> {
    const organization = await this.organizationRepository.findById(orgId);
    if (!organization) {
      throw new NotFoundError('Organization', orgId);
    }
    const template = await this.serviceTemplateRepository.save(
      ServiceTemplate.create({
        orgId,
        tradeType: body.tradeType ?? organization.tradeType,
        name: body.name,
        description: body.description || undefined,
        basePrice: body.basePrice,
        defaultLaborHours: body.defaultLaborHours,
        fields: body.fields,
        isActive: body.isActive,
      })
    );
    return toServiceTemplateDto(template);
  }
}
