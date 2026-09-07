import { ValidationError } from '../../../domain/errors/ValidationError';
import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { AuthService } from '../../services/AuthService';
import { AuthResult, LoginCommand } from '../../dtos/AuthDtos';
import { toUserDto } from '../../mappers/UserMapper';

export class LoginUseCase {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: LoginCommand): Promise<AuthResult> {
    if (!command.email?.trim()) {
      throw new ValidationError({ email: ['Email is required'] });
    }
    if (!command.password) {
      throw new ValidationError({ password: ['Password is required'] });
    }

    const user = await this.userRepository.findByEmail(command.email.trim().toLowerCase());
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await this.authService.comparePasswords(
      command.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const loggedIn = await this.userRepository.update(user.withLastLogin());

    return {
      user: toUserDto(loggedIn),
      tokens: this.authService.generateTokenPair(loggedIn),
    };
  }
}
