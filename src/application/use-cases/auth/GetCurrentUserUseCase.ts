import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserDto } from '../../dtos/AuthDtos';
import { toUserDto } from '../../mappers/UserMapper';

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return toUserDto(user);
  }
}
