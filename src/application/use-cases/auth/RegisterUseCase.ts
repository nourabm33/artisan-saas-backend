import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { User } from '../../../domain/entities/User';
import { Organization } from '../../../domain/entities/Organization';
import { ConflictError } from '../../../domain/errors/ConflictError';
import { ValidationError, ValidationErrors } from '../../../domain/errors/ValidationError';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';
import { AuthService } from '../../services/AuthService';
import { AuthResult, RegisterCommand } from '../../dtos/AuthDtos';
import { toUserDto } from '../../mappers/UserMapper';

export class RegisterUseCase {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: IUserRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(command: RegisterCommand): Promise<AuthResult> {
    this.validateCommand(command);

    const email = new Email(command.email);
    const phone = new Phone(command.phone);

    const existingUser = await this.userRepository.findByEmail(email.get());
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await this.authService.hashPassword(command.password);

    const organization = await this.organizationRepository.save(
      Organization.create({
        name: command.organizationName.trim(),
        tradeType: command.tradeType.trim().toLowerCase(),
      })
    );

    let user: User;
    try {
      user = await this.userRepository.save(
        User.create({
          orgId: organization.id,
          email,
          phone,
          firstName: command.firstName.trim(),
          lastName: command.lastName.trim(),
          passwordHash,
          role: 'owner',
        })
      );
    } catch (err) {
      await this.organizationRepository.delete(organization.id).catch(() => undefined);
      throw err;
    }

    return {
      user: toUserDto(user),
      tokens: this.authService.generateTokenPair(user),
    };
  }

  private validateCommand(command: RegisterCommand): void {
    const errors: ValidationErrors = {};

    if (!command.firstName?.trim()) errors.firstName = ['First name is required'];
    if (!command.lastName?.trim()) errors.lastName = ['Last name is required'];
    if (!command.email?.trim()) errors.email = ['Email is required'];
    if (!command.phone?.trim()) errors.phone = ['Phone is required'];
    if (!command.password || command.password.length < 8) {
      errors.password = ['Password must be at least 8 characters'];
    }
    if (command.password !== command.passwordConfirm) {
      errors.passwordConfirm = ['Passwords do not match'];
    }
    if (!command.organizationName?.trim()) {
      errors.organizationName = ['Organization name is required'];
    }
    if (!command.tradeType?.trim()) errors.tradeType = ['Trade type is required'];

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }
  }
}
