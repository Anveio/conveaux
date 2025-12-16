import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DurableStorage, Migration } from '@conveaux/contract-durable-storage';

import {
  NODE_SQLITE_MIN_VERSION,
  createInMemoryStorage,
  isNodeSqliteAvailable,
} from './node-sqlite-adapter.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Create users table',
    up: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      )
    `,
    down: 'DROP TABLE users',
  },
  {
    version: 2,
    description: 'Add created_at column',
    up: `ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'))`,
  },
  {
    version: 3,
    description: 'Create posts table',
    up: `
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `,
    down: 'DROP TABLE posts',
  },
];

// =============================================================================
// Tests
// =============================================================================

describe('createNodeSqliteStorage', () => {
  let storage: DurableStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  afterEach(() => {
    if (storage.isOpen) {
      storage.close();
    }
  });

  describe('basic operations', () => {
    it('should execute DDL statements', () => {
      storage.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');

      // Verify table exists by querying it
      const stmt = storage.prepare<{ count: number }>('SELECT COUNT(*) as count FROM test');
      const result = stmt.get();
      expect(result?.count).toBe(0);
    });

    it('should prepare and execute parameterized queries', () => {
      storage.execute('CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT)');

      const insert = storage.prepare('INSERT INTO kv (key, val) VALUES (?, ?)');
      insert.run('a', '1');
      insert.run('b', '2');

      const select = storage.prepare<{ key: string; val: string }>(
        'SELECT * FROM kv WHERE key = ?'
      );
      expect(select.get('a')?.val).toBe('1');
      expect(select.get('b')?.val).toBe('2');
      expect(select.get('missing')).toBeUndefined();
    });

    it('should return all matching rows', () => {
      storage.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');

      const insert = storage.prepare('INSERT INTO items (name) VALUES (?)');
      insert.run('apple');
      insert.run('banana');
      insert.run('cherry');

      const selectAll = storage.prepare<{ id: number; name: string }>(
        'SELECT * FROM items ORDER BY id'
      );
      const rows = selectAll.all();

      expect(rows).toHaveLength(3);
      expect(rows[0]!.name).toBe('apple');
      expect(rows[1]!.name).toBe('banana');
      expect(rows[2]!.name).toBe('cherry');
    });

    it('should return run result with changes and lastId', () => {
      storage.execute('CREATE TABLE counter (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER)');

      const insert = storage.prepare('INSERT INTO counter (value) VALUES (?)');
      const result1 = insert.run(100);
      const result2 = insert.run(200);

      expect(result1.changes).toBe(1);
      expect(result1.lastId).toBe(1);
      expect(result2.changes).toBe(1);
      expect(result2.lastId).toBe(2);

      const update = storage.prepare('UPDATE counter SET value = value + 1');
      const updateResult = update.run();
      expect(updateResult.changes).toBe(2);
    });
  });

  describe('connection lifecycle', () => {
    it('should report isOpen correctly', () => {
      expect(storage.isOpen).toBe(true);
      storage.close();
      expect(storage.isOpen).toBe(false);
    });
  });

  describe('migrations', () => {
    it('should apply migrations in order', () => {
      const result = storage.migrate(TEST_MIGRATIONS);

      expect(result.applied).toHaveLength(3);
      expect(result.applied[0]!.version).toBe(1);
      expect(result.applied[1]!.version).toBe(2);
      expect(result.applied[2]!.version).toBe(3);
      expect(result.currentVersion).toBe(3);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track schema version', () => {
      expect(storage.getSchemaVersion()).toBe(0);

      storage.migrate([TEST_MIGRATIONS[0]!]);
      expect(storage.getSchemaVersion()).toBe(1);

      storage.migrate([TEST_MIGRATIONS[0]!, TEST_MIGRATIONS[1]!]);
      expect(storage.getSchemaVersion()).toBe(2);
    });

    it('should skip already applied migrations', () => {
      // Apply first migration
      const result1 = storage.migrate([TEST_MIGRATIONS[0]!]);
      expect(result1.applied).toHaveLength(1);

      // Apply all migrations - should only apply remaining
      const result2 = storage.migrate(TEST_MIGRATIONS);
      expect(result2.applied).toHaveLength(2);
      expect(result2.applied[0]!.version).toBe(2);
      expect(result2.applied[1]!.version).toBe(3);
    });

    it('should handle migrations out of order', () => {
      // Pass migrations in wrong order - should still apply in version order
      const result = storage.migrate([
        TEST_MIGRATIONS[2]!,
        TEST_MIGRATIONS[0]!,
        TEST_MIGRATIONS[1]!,
      ]);

      expect(result.applied).toHaveLength(3);
      expect(result.applied[0]!.version).toBe(1);
      expect(result.applied[1]!.version).toBe(2);
      expect(result.applied[2]!.version).toBe(3);
    });

    it('should be idempotent', () => {
      storage.migrate(TEST_MIGRATIONS);
      const result = storage.migrate(TEST_MIGRATIONS);

      expect(result.applied).toHaveLength(0);
      expect(result.currentVersion).toBe(3);
    });

    it('should make tables usable after migration', () => {
      storage.migrate(TEST_MIGRATIONS);

      // Insert into users table created by migration
      const insertUser = storage.prepare<{ id: number }>(
        'INSERT INTO users (name, email) VALUES (?, ?) RETURNING id'
      );
      const user = insertUser.get('Alice', 'alice@example.com');
      expect(user?.id).toBe(1);

      // Insert into posts table
      const insertPost = storage.prepare('INSERT INTO posts (user_id, title) VALUES (?, ?)');
      insertPost.run(1, 'Hello World');

      // Query posts
      const posts = storage.prepare<{ title: string }>('SELECT title FROM posts WHERE user_id = ?');
      expect(posts.get(1)?.title).toBe('Hello World');
    });
  });
});

describe('isNodeSqliteAvailable', () => {
  it('should return true on Node.js >= 22.5.0', () => {
    // We're running on Node.js 24.7.0, so this should be true
    expect(isNodeSqliteAvailable()).toBe(true);
  });

  it('should export minimum version constant', () => {
    expect(NODE_SQLITE_MIN_VERSION).toBe('22.5.0');
  });
});
