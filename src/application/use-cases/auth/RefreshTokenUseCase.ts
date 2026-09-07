import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { AuthService, TokenPair } from '../../services/AuthService';
import { RefreshTokenCommand } from '../../dtos/AuthDtos';

export class RefreshTokenUseCase {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: RefreshTokenCommand): Promise<TokenPair> {
    if (!command.refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const payload = this.authService.verifyToken(command.refreshToken, 'refresh');

    const user = await this.userRepository.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return this.authService.generateTokenPair(user);
  }
}
