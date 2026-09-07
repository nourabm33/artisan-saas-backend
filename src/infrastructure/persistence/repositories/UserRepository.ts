import { Pool } from 'pg';
import { User, UserRole } from '../../../domain/entities/User';
import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ConflictError } from '../../../domain/errors/ConflictError';
import { isUniqueViolation } from '../pgErrors';

interface UserRow {
  id: string;
  org_id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? UserRepository.toEntity(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    return result.rows[0] ? UserRepository.toEntity(result.rows[0]) : null;
  }

  async findByOrgId(orgId: string): Promise<User[]> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE org_id = $1 ORDER BY created_at',
      [orgId]
    );
    return result.rows.map(UserRepository.toEntity);
  }

  async save(user: User): Promise<User> {
    const query = `
      INSERT INTO users (id, org_id, email, phone, password_hash, first_name, last_name, role, is_active, last_login_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    try {
      const result = await this.pool.query<UserRow>(query, [
        user.id,
        user.orgId,
        user.email.get(),
        user.phone?.toE164() ?? null,
        user.passwordHash,
        user.firstName,
        user.lastName,
        user.role,
        user.isActive,
        user.lastLoginAt ?? null,
        user.createdAt,
        user.updatedAt,
      ]);
      return UserRepository.toEntity(result.rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('Email already registered');
      }
      throw err;
    }
  }

  async update(user: User): Promise<User> {
    const query = `
      UPDATE users SET org_id = $2, email = $3, phone = $4, password_hash = $5,
        first_name = $6, last_name = $7, role = $8, is_active = $9, last_login_at = $10, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<UserRow>(query, [
      user.id,
      user.orgId,
      user.email.get(),
      user.phone?.toE164() ?? null,
      user.passwordHash,
      user.firstName,
      user.lastName,
      user.role,
      user.isActive,
      user.lastLoginAt ?? null,
    ]);
    return UserRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  private static toEntity(row: UserRow): User {
    return new User({
      id: row.id,
      orgId: row.org_id,
      email: new Email(row.email),
      phone: row.phone ? new Phone(row.phone) : undefined,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      passwordHash: row.password_hash,
      role: row.role,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
