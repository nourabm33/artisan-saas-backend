import {
  IRequestRepository,
  RequestFilters,
} from '../../../domain/repositories/IRequestRepository';
import { RequestDto } from '../../dtos/RequestDtos';
import { toRequestDto } from '../../mappers/RequestMappers';

export class ListRequestsUseCase {
  constructor(private readonly requestRepository: IRequestRepository) {}

  async execute(orgId: string, filters: RequestFilters = {}): Promise<RequestDto[]> {
    const requests = await this.requestRepository.findByOrgId(orgId, filters);
    return requests.map(toRequestDto);
  }
}
