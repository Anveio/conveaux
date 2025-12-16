/**
 * Node.js SQLite adapter for DurableStorage.
 *
 * Uses the built-in node:sqlite module (Node.js >= 22.5.0).
 * Provides DurableStorage implementation with migration support.
 */

import { DatabaseSync } from 'node:sqlite';
import type {
  DurableStorage,
  DurableStorageFactory,
  Migration,
  MigrationResult,
  PreparedQuery,
  RunResult,
} from '@conveaux/contract-durable-storage';

// =============================================================================
// Schema Version Helpers
// =============================================================================

/**
 * Get current schema version from SQLite's user_version pragma.
 */
function getSchemaVersion(db: DatabaseSync): number {
  const stmt = db.prepare('PRAGMA user_version');
  const result = stmt.get() as { user_version: number } | undefined;
  return result?.user_version ?? 0;
}

/**
 * Set schema version using SQLite's user_version pragma.
 */
function setSchemaVersion(db: DatabaseSync, version: number): void {
  db.exec(`PRAGMA user_version = ${version}`);
}

// =============================================================================
// Migration Implementation
// =============================================================================

/**
 * Run migrations against the database.
 * Only applies migrations with version > current schema version.
 */
function runMigrations(db: DatabaseSync, migrations: readonly Migration[]): MigrationResult {
  const startTime = Date.now();
  const currentVersion = getSchemaVersion(db);
  const applied: Migration[] = [];

  // Sort by version ascending, filter already applied
  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((m) => m.version > currentVersion);

  for (const migration of pending) {
    // Execute migration SQL
    db.exec(migration.up);
    // Update schema version after successful migration
    setSchemaVersion(db, migration.version);
    applied.push(migration);
  }

  return {
    applied,
    currentVersion: getSchemaVersion(db),
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// Prepared Query Implementation
// =============================================================================

/**
 * Result type from node:sqlite statement execution.
 * Explicitly defined since node:sqlite is experimental and types may vary.
 */
interface NodeSqliteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Wrap a node:sqlite statement as PreparedQuery.
 * Casts params at the adapter boundary to satisfy node:sqlite's strict types.
 */
function wrapStatement<TRow>(stmt: ReturnType<DatabaseSync['prepare']>): PreparedQuery<TRow> {
  return {
    run(...params: unknown[]): RunResult {
      // Cast params at adapter boundary - node:sqlite expects specific SQLInputValue types
      const result = stmt.run(...(params as Parameters<typeof stmt.run>)) as NodeSqliteRunResult;
      return {
        changes: result.changes,
        lastId: result.lastInsertRowid,
      };
    },
    get(...params: unknown[]): TRow | undefined {
      return stmt.get(...(params as Parameters<typeof stmt.get>)) as TRow | undefined;
    },
    all(...params: unknown[]): TRow[] {
      return stmt.all(...(params as Parameters<typeof stmt.all>)) as TRow[];
    },
  };
}

// =============================================================================
// DurableStorage Implementation
// =============================================================================

/**
 * Create DurableStorage using Node.js built-in sqlite.
 * Requires Node.js >= 22.5.0.
 *
 * @param path - Path to database file, or ':memory:' for in-memory
 * @returns DurableStorage implementation
 *
 * @example
 * ```typescript
 * const storage = createNodeSqliteStorage('./data.db');
 * storage.migrate(MIGRATIONS);
 * const stmt = storage.prepare('SELECT * FROM users');
 * const users = stmt.all();
 * storage.close();
 * ```
 */
export function createNodeSqliteStorage(path: string): DurableStorage {
  const db = new DatabaseSync(path);

  return {
    execute(sql: string): void {
      db.exec(sql);
    },

    prepare<TRow = unknown>(sql: string): PreparedQuery<TRow> {
      const stmt = db.prepare(sql);
      return wrapStatement<TRow>(stmt);
    },

    migrate(migrations: readonly Migration[]): MigrationResult {
      return runMigrations(db, migrations);
    },

    getSchemaVersion(): number {
      return getSchemaVersion(db);
    },

    close(): void {
      db.close();
    },

    get isOpen(): boolean {
      return db.isOpen;
    },
  };
}

/**
 * Create in-memory storage for testing.
 * Data is lost when the storage is closed.
 *
 * @example
 * ```typescript
 * const storage = createInMemoryStorage();
 * storage.execute('CREATE TABLE test (id INTEGER)');
 * // ... run tests
 * storage.close();
 * ```
 */
export function createInMemoryStorage(): DurableStorage {
  return createNodeSqliteStorage(':memory:');
}

/**
 * Factory function for creating Node.js SQLite storage.
 */
export const nodeSqliteFactory: DurableStorageFactory = createNodeSqliteStorage;

/**
 * Check if node:sqlite is available in the current runtime.
 *
 * @returns true if node:sqlite can be imported
 */
export function isNodeSqliteAvailable(): boolean {
  try {
    // Dynamic require to avoid compile-time errors
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}

/**
 * Minimum Node.js version required for node:sqlite.
 */
export const NODE_SQLITE_MIN_VERSION = '22.5.0';
