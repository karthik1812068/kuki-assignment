import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: bigint('github_id', { mode: 'bigint' }).notNull().unique(),
  githubLogin: text('github_login').notNull(),
  email: text('email'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const githubCredentials = pgTable('github_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessTokenCiphertext: text('access_token_ciphertext').notNull(),
  scopes: text('scopes').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    githubRepoId: bigint('github_repo_id', { mode: 'bigint' }).notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull(),
    defaultBranch: text('default_branch').notNull(),
    language: text('language'),
    description: text('description'),
    private: boolean('private').notNull(),
    htmlUrl: text('html_url').notNull(),
    permission: text('permission').notNull(),
    status: text('status').notNull(),
    cloneError: text('clone_error'),
    indexingStatus: text('indexing_status').notNull().default('not_started'),
    indexingError: text('indexing_error'),
    indexTruncated: boolean('index_truncated').notNull().default(false),
    indexedAt: timestamp('indexed_at', { withTimezone: true }),
    indexedFileCount: integer('indexed_file_count'),
    indexedChunkCount: integer('indexed_chunk_count'),
    detectedLanguages: text('detected_languages'),
    detectedFrameworks: text('detected_frameworks'),
    detectedPackageManagers: text('detected_package_managers'),
    detectedTestFrameworks: text('detected_test_frameworks'),
    embeddingModel: text('embedding_model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('repositories_owner_github_idx').on(table.ownerId, table.githubRepoId)],
);
