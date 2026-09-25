import { and, eq, gt, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { githubCredentials, sessions, users } from './schema';
import { createSessionId } from './session-id';

export interface StoredUser {
  id: string;
  githubId: string;
  githubLogin: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface GitHubUserWrite {
  githubId: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface SessionUser {
  user: StoredUser;
  scopes: string;
}

export class PgAuthRepository {
  private readonly db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async upsertUser(input: GitHubUserWrite): Promise<StoredUser> {
    const githubId = BigInt(input.githubId);
    const now = new Date();
    const rows = await this.db
      .insert(users)
      .values({
        githubId,
        githubLogin: input.login,
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.githubId,
        set: {
          githubLogin: input.login,
          email: input.email,
          name: input.name,
          avatarUrl: input.avatarUrl,
          updatedAt: now,
        },
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('User was not saved.');
    }
    return mapUser(row);
  }

  async saveCredential(userId: string, ciphertext: string, scopes: string): Promise<void> {
    await this.db
      .insert(githubCredentials)
      .values({
        userId,
        accessTokenCiphertext: ciphertext,
        scopes,
      })
      .onConflictDoUpdate({
        target: githubCredentials.userId,
        set: {
          accessTokenCiphertext: ciphertext,
          scopes,
          updatedAt: new Date(),
        },
      });
  }

  async createSession(
    userId: string,
    now: Date,
    ttlMs: number,
  ): Promise<{ id: string; maxAgeSeconds: number }> {
    const id = createSessionId();
    const expiresAt = new Date(now.getTime() + ttlMs);
    await this.db.insert(sessions).values({ id, userId, expiresAt });
    return { id, maxAgeSeconds: Math.max(1, Math.floor(ttlMs / 1000)) };
  }

  async findSessionUser(sessionId: string, now: Date): Promise<SessionUser | null> {
    const rows = await this.db
      .select({
        user: users,
        scopes: githubCredentials.scopes,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .leftJoin(githubCredentials, eq(githubCredentials.userId, users.id))
      .where(
        and(eq(sessions.id, sessionId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return { user: mapUser(row.user), scopes: row.scopes ?? '' };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async deleteUserByGitHubId(githubId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.githubId, BigInt(githubId)));
  }

  async findCredential(userId: string): Promise<{ ciphertext: string; scopes: string } | null> {
    const rows = await this.db
      .select({
        ciphertext: githubCredentials.accessTokenCiphertext,
        scopes: githubCredentials.scopes,
      })
      .from(githubCredentials)
      .where(eq(githubCredentials.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }
}

function mapUser(row: typeof users.$inferSelect): StoredUser {
  return {
    id: row.id,
    githubId: row.githubId.toString(),
    githubLogin: row.githubLogin,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
  };
}
