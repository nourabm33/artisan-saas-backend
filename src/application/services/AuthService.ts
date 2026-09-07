import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../../domain/entities/User';
import { UnauthorizedError } from '../../domain/errors/UnauthorizedError';

export type TokenType = 'access' | 'refresh';

export interface TokenPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  type: TokenType;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const SALT_ROUNDS = 10;

export class AuthService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtAccessExpiry: string,
    private readonly jwtRefreshExpiry: string
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(user: User): string {
    return this.sign(user, 'access', this.jwtAccessExpiry);
  }

  generateRefreshToken(user: User): string {
    return this.sign(user, 'refresh', this.jwtRefreshExpiry);
  }

  generateTokenPair(user: User): TokenPair {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }

  verifyToken(token: string, expectedType: TokenType): TokenPayload {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, this.jwtSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    if (!AuthService.isTokenPayload(decoded) || decoded.type !== expectedType) {
      throw new UnauthorizedError('Invalid token');
    }
    return decoded;
  }

  private sign(user: User, type: TokenType, expiresIn: string): string {
    const payload: TokenPayload = {
      userId: user.id,
      orgId: user.orgId,
      email: user.email.get(),
      role: user.role,
      type,
    };
    const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
    return jwt.sign(payload, this.jwtSecret, options);
  }

  private static isTokenPayload(value: unknown): value is TokenPayload {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v.userId === 'string' &&
      typeof v.orgId === 'string' &&
      typeof v.email === 'string' &&
      typeof v.role === 'string' &&
      (v.type === 'access' || v.type === 'refresh')
    );
  }
}
