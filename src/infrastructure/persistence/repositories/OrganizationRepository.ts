import { Pool } from 'pg';
import { Organization, SubscriptionTier } from '../../../domain/entities/Organization';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';

interface OrganizationRow {
  id: string;
  name: string;
  trade_type: string;
  country_code: string;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class OrganizationRepository implements IOrganizationRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Organization | null> {
    const result = await this.pool.query<OrganizationRow>(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );
    return result.rows[0] ? OrganizationRepository.toEntity(result.rows[0]) : null;
  }

  async save(organization: Organization): Promise<Organization> {
    const query = `
      INSERT INTO organizations (id, name, trade_type, country_code, subscription_tier, stripe_customer_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await this.pool.query<OrganizationRow>(query, [
      organization.id,
      organization.name,
      organization.tradeType,
      organization.countryCode,
      organization.subscriptionTier,
      organization.stripeCustomerId ?? null,
      organization.createdAt,
      organization.updatedAt,
    ]);
    return OrganizationRepository.toEntity(result.rows[0]);
  }

  async update(organization: Organization): Promise<Organization> {
    const query = `
      UPDATE organizations SET name = $2, trade_type = $3, country_code = $4,
        subscription_tier = $5, stripe_customer_id = $6, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<OrganizationRow>(query, [
      organization.id,
      organization.name,
      organization.tradeType,
      organization.countryCode,
      organization.subscriptionTier,
      organization.stripeCustomerId ?? null,
    ]);
    return OrganizationRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM organizations WHERE id = $1', [id]);
  }

  private static toEntity(row: OrganizationRow): Organization {
    return new Organization({
      id: row.id,
      name: row.name,
      tradeType: row.trade_type,
      countryCode: row.country_code,
      subscriptionTier: row.subscription_tier,
      stripeCustomerId: row.stripe_customer_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
