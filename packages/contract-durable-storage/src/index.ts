/**
 * @conveaux/contract-durable-storage
 *
 * Runtime-agnostic durable storage contract with migration support.
 * Apps inject SQLite implementation (node:sqlite, bun:sqlite).
 *
 * Inspired by better-sqlite3-migrate:
 * https://github.com/farjs/better-sqlite3-migrate
 */

// =============================================================================
// Core Storage Interface
// =============================================================================

/**
 * A durable storage connection with migration support.
 * Synchronous API for simplicity in CLI contexts.
 */
export interface DurableStorage {
  /**
   * Execute DDL/modification without results.
   * Use for CREATE TABLE, INSERT, UPDATE, DELETE.
   */
  execute(sql: string): void;

  /**
   * Prepare a parameterized statement for repeated execution.
   * Prepared statements are more efficient for repeated queries.
   */
  prepare<TRow = unknown>(sql: string): PreparedQuery<TRow>;

  /**
   * Run migrations (idempotent - only applies new ones).
   * Uses SQLite's user_version pragma to track schema version.
   */
  migrate(migrations: readonly Migration[]): MigrationResult;

  /**
   * Get current schema version from user_version pragma.
   */
  getSchemaVersion(): number;

  /**
   * Close the storage connection.
   * Should be called when storage is no longer needed.
   */
  close(): void;

  /**
   * Check if storage connection is open.
   */
  readonly isOpen: boolean;
}

// =============================================================================
// Prepared Query Interface
// =============================================================================

/**
 * Prepared query for parameterized execution.
 * Provides type-safe access to query results.
 */
export interface PreparedQuery<TRow> {
  /**
   * Execute modification, return affected count.
   * Use for INSERT, UPDATE, DELETE.
   */
  run(...params: unknown[]): RunResult;

  /**
   * Get first matching row or undefined.
   * Use for SELECT queries expecting 0-1 rows.
   */
  get(...params: unknown[]): TRow | undefined;

  /**
   * Get all matching rows.
   * Use for SELECT queries expecting multiple rows.
   */
  all(...params: unknown[]): TRow[];
}

/**
 * Result of a modification query.
 */
export interface RunResult {
  /** Number of rows changed */
  readonly changes: number;
  /** Last inserted rowid (for INSERT with AUTOINCREMENT) */
  readonly lastId: number | bigint;
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * A database migration.
 * Migrations are applied in version order (ascending).
 */
export interface Migration {
  /**
   * Version number (must be unique).
   * Migrations are applied in ascending order.
   */
  readonly version: number;

  /**
   * Human-readable description for logging.
   */
  readonly description: string;

  /**
   * SQL to apply this migration.
   * Can contain multiple statements separated by semicolons.
   */
  readonly up: string;

  /**
   * SQL to rollback this migration (optional).
   * Note: SQLite has limited ALTER TABLE support.
   */
  readonly down?: string;
}

/**
 * Result of running migrations.
 */
export interface MigrationResult {
  /** Migrations that were applied in this run */
  readonly applied: readonly Migration[];
  /** Current schema version after migrations */
  readonly currentVersion: number;
  /** Total time in milliseconds */
  readonly durationMs: number;
}

// =============================================================================
// Factory Type
// =============================================================================

/**
 * Factory function type for creating durable storage.
 * Apps implement this using their runtime's SQLite.
 *
 * @example Node.js implementation
 * ```typescript
 * import { DatabaseSync } from 'node:sqlite';
 *
 * export function createNodeSqliteStorage(path: string): DurableStorage {
 *   const db = new DatabaseSync(path);
 *   return { ... };
 * }
 * ```
 *
 * @example Bun implementation
 * ```typescript
 * import { Database } from 'bun:sqlite';
 *
 * export function createBunSqliteStorage(path: string): DurableStorage {
 *   const db = new Database(path);
 *   return { ... };
 * }
 * ```
 */
export type DurableStorageFactory = (path: string) => DurableStorage;
