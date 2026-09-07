import { RegisterUseCase } from '@/application/use-cases/auth/RegisterUseCase';
import { AuthService } from '@/application/services/AuthService';
import { RegisterCommand } from '@/application/dtos/AuthDtos';
import { ConflictError, ValidationError } from '@/domain/errors';
import {
  InMemoryOrganizationRepository,
  InMemoryUserRepository,
} from '../helpers/inMemoryRepositories';

const validCommand: RegisterCommand = {
  organizationName: 'Test Gommista',
  tradeType: 'gommista',
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'Mario@Example.com',
  phone: '+39 333 123 4567',
  password: 'SecurePassword123!',
  passwordConfirm: 'SecurePassword123!',
};

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let users: InMemoryUserRepository;
  let orgs: InMemoryOrganizationRepository;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    orgs = new InMemoryOrganizationRepository();
    useCase = new RegisterUseCase(
      new AuthService('test-secret-test-secret', '15m', '7d'),
      users,
      orgs
    );
  });

  it('registers a new owner and organization, returning tokens', async () => {
    const result = await useCase.execute(validCommand);

    expect(result.user.email).toBe('mario@example.com');
    expect(result.user.role).toBe('owner');
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));

    expect(orgs.organizations.size).toBe(1);
    const [org] = orgs.organizations.values();
    expect(org.name).toBe('Test Gommista');
    expect(result.user.orgId).toBe(org.id);

    const saved = await users.findByEmail('mario@example.com');
    expect(saved?.phone?.toE164()).toBe('+393331234567');
    expect(saved?.passwordHash).not.toBe(validCommand.password);
  });

  it('throws ConflictError if email already exists', async () => {
    await useCase.execute(validCommand);
    await expect(useCase.execute(validCommand)).rejects.toThrow(ConflictError);
    expect(orgs.organizations.size).toBe(1);
  });

  it('throws ValidationError if passwords do not match', async () => {
    await expect(
      useCase.execute({ ...validCommand, passwordConfirm: 'DifferentPassword123!' })
    ).rejects.toThrow(ValidationError);
  });

  it('collects all validation errors at once', async () => {
    const promise = useCase.execute({
      ...validCommand,
      firstName: '',
      organizationName: ' ',
      password: 'short',
      passwordConfirm: 'short',
    });

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await promise.catch((err: ValidationError) => {
      expect(Object.keys(err.errors).sort()).toEqual(['firstName', 'organizationName', 'password']);
    });
  });

  it('rejects an invalid phone number', async () => {
    await expect(useCase.execute({ ...validCommand, phone: '12' })).rejects.toThrow(
      ValidationError
    );
    expect(orgs.organizations.size).toBe(0);
  });

  it('rolls back the organization when saving the user fails', async () => {
    jest.spyOn(users, 'save').mockRejectedValueOnce(new Error('db down'));
    await expect(useCase.execute(validCommand)).rejects.toThrow('db down');
    expect(orgs.organizations.size).toBe(0);
  });
});
