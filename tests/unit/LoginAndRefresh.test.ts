import { AuthService } from '@/application/services/AuthService';
import { LoginUseCase } from '@/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '@/application/use-cases/auth/RefreshTokenUseCase';
import { User } from '@/domain/entities/User';
import { Email } from '@/domain/value-objects/Email';
import { UnauthorizedError, ValidationError } from '@/domain/errors';
import { InMemoryUserRepository } from '../helpers/inMemoryRepositories';

const authService = new AuthService('test-secret-test-secret', '15m', '7d');

const makeUser = async (overrides: Partial<{ isActive: boolean }> = {}): Promise<User> =>
  User.create({
    orgId: 'org-1',
    email: new Email('mario@example.com'),
    firstName: 'Mario',
    lastName: 'Rossi',
    passwordHash: await authService.hashPassword('Password123!'),
    role: 'owner',
    isActive: overrides.isActive,
  });

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: LoginUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    await users.save(await makeUser());
    useCase = new LoginUseCase(authService, users);
  });

  it('returns tokens and records last login for valid credentials', async () => {
    const result = await useCase.execute({ email: 'MARIO@example.com', password: 'Password123!' });

    expect(result.user.email).toBe('mario@example.com');
    const payload = authService.verifyToken(result.tokens.accessToken, 'access');
    expect(payload).toMatchObject({ email: 'mario@example.com', role: 'owner', type: 'access' });

    const stored = await users.findByEmail('mario@example.com');
    expect(stored?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects wrong password', async () => {
    await expect(
      useCase.execute({ email: 'mario@example.com', password: 'wrong' })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejects unknown email with the same error', async () => {
    await expect(
      useCase.execute({ email: 'nobody@example.com', password: 'Password123!' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects inactive users', async () => {
    const inactive = new InMemoryUserRepository();
    await inactive.save(await makeUser({ isActive: false }));
    await expect(
      new LoginUseCase(authService, inactive).execute({
        email: 'mario@example.com',
        password: 'Password123!',
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('validates required fields', async () => {
    await expect(useCase.execute({ email: '', password: 'x' })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ email: 'a@b.co', password: '' })).rejects.toThrow(
      ValidationError
    );
  });
});

describe('RefreshTokenUseCase', () => {
  let users: InMemoryUserRepository;
  let user: User;
  let useCase: RefreshTokenUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    user = await users.save(await makeUser());
    useCase = new RefreshTokenUseCase(authService, users);
  });

  it('issues a new token pair for a valid refresh token', async () => {
    const refreshToken = authService.generateRefreshToken(user);
    const result = await useCase.execute({ refreshToken });

    expect(authService.verifyToken(result.accessToken, 'access').userId).toBe(user.id);
    expect(authService.verifyToken(result.refreshToken, 'refresh').userId).toBe(user.id);
  });

  it('rejects an access token used as refresh token', async () => {
    const accessToken = authService.generateAccessToken(user);
    await expect(useCase.execute({ refreshToken: accessToken })).rejects.toThrow(UnauthorizedError);
  });

  it('rejects tokens signed with another secret', async () => {
    const other = new AuthService('another-secret-another', '15m', '7d');
    await expect(
      useCase.execute({ refreshToken: other.generateRefreshToken(user) })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejects if the user no longer exists', async () => {
    const refreshToken = authService.generateRefreshToken(user);
    await users.delete(user.id);
    await expect(useCase.execute({ refreshToken })).rejects.toThrow(UnauthorizedError);
  });
});
