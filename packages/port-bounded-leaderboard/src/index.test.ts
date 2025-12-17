import { describe, expect, it } from 'vitest';
import {
  createBoundedLeaderboard,
  getAllEntries,
  getRank,
  getRecentChanges,
  getScore,
  getTopN,
  hasItem,
  isEmpty,
  isFull,
  removeItem,
  size,
  updateScore,
  validateBoundedLeaderboard,
} from './index.js';

describe('createBoundedLeaderboard', () => {
  describe('creation', () => {
    it('creates an empty bounded leaderboard', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 100,
        historySize: 50,
      });

      expect(size(board)).toBe(0);
      expect(isEmpty(board)).toBe(true);
      expect(getAllEntries(board)).toEqual([]);
      expect(getRecentChanges(board)).toEqual([]);
    });

    it('creates leaderboard with unlimited entries (maxEntries = 0)', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(size(board)).toBe(0);
      expect(board.maxEntries).toBe(0);
    });

    it('throws on negative maxEntries', () => {
      expect(() =>
        createBoundedLeaderboard<string>({
          maxEntries: -1,
          historySize: 10,
        })
      ).toThrow('maxEntries must be non-negative');
    });

    it('throws on invalid historySize', () => {
      expect(() =>
        createBoundedLeaderboard<string>({
          maxEntries: 10,
          historySize: 0,
        })
      ).toThrow('historySize must be positive');
    });
  });

  describe('updateScore', () => {
    it('adds new items to the leaderboard', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500, 1000);
      expect(size(board)).toBe(1);
      expect(getScore(board, 'alice')).toBe(1500);
      expect(hasItem(board, 'alice')).toBe(true);

      board = updateScore(board, 'bob', 1800, 2000);
      expect(size(board)).toBe(2);
      expect(getScore(board, 'bob')).toBe(1800);
    });

    it('updates existing item scores', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500, 1000);
      expect(getScore(board, 'alice')).toBe(1500);

      board = updateScore(board, 'alice', 1800, 2000);
      expect(size(board)).toBe(1);
      expect(getScore(board, 'alice')).toBe(1800);
    });

    it('maintains descending score order', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500, 1000);
      board = updateScore(board, 'bob', 1800, 2000);
      board = updateScore(board, 'charlie', 1200, 3000);

      const entries = getAllEntries(board);
      expect(entries).toEqual([
        { item: 'bob', score: 1800 },
        { item: 'alice', score: 1500 },
        { item: 'charlie', score: 1200 },
      ]);
    });

    it('records score changes in history', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500, 1000);
      board = updateScore(board, 'alice', 1800, 2000);

      const history = getRecentChanges(board);
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        item: 'alice',
        oldScore: undefined,
        newScore: 1500,
        timestamp: 1000,
      });
      expect(history[1]).toEqual({
        item: 'alice',
        oldScore: 1500,
        newScore: 1800,
        timestamp: 2000,
      });
    });

    it('enforces maxEntries limit by removing lowest scorer', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 3,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);
      board = updateScore(board, 'charlie', 1200);
      expect(size(board)).toBe(3);

      board = updateScore(board, 'dave', 1600);
      expect(size(board)).toBe(3);
      expect(hasItem(board, 'charlie')).toBe(false); // Lowest score removed
      expect(hasItem(board, 'dave')).toBe(true);
    });

    it('does not remove items when score update changes ranking', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 3,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);
      board = updateScore(board, 'charlie', 1200);

      board = updateScore(board, 'alice', 2000); // Alice moves to top
      expect(size(board)).toBe(3);
      expect(hasItem(board, 'alice')).toBe(true);
      expect(hasItem(board, 'bob')).toBe(true);
      expect(hasItem(board, 'charlie')).toBe(true);
    });

    it('maintains immutability', () => {
      const original = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 5,
      });

      const modified = updateScore(original, 'alice', 1500);

      expect(size(original)).toBe(0);
      expect(size(modified)).toBe(1);
    });
  });

  describe('removeItem', () => {
    it('removes existing items', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      const result = removeItem(board, 'alice', 1000);
      expect(result.removed).toBe(true);
      expect(size(result.board)).toBe(1);
      expect(hasItem(result.board, 'alice')).toBe(false);
      expect(hasItem(result.board, 'bob')).toBe(true);
    });

    it('returns false when item not found', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);

      const result = removeItem(board, 'bob');
      expect(result.removed).toBe(false);
      expect(size(result.board)).toBe(1);
    });

    it('records removal in history', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500, 1000);
      const result = removeItem(board, 'alice', 2000);

      const history = getRecentChanges(result.board);
      expect(history).toHaveLength(2);
      expect(history[1]).toEqual({
        item: 'alice',
        oldScore: 1500,
        newScore: 0,
        timestamp: 2000,
      });
    });

    it('maintains immutability', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      const result = removeItem(board, 'alice');

      expect(size(board)).toBe(2);
      expect(size(result.board)).toBe(1);
    });
  });

  describe('getRank', () => {
    it('returns correct ranks (0-based, descending)', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);
      board = updateScore(board, 'charlie', 1200);

      expect(getRank(board, 'bob')).toBe(0); // Highest score
      expect(getRank(board, 'alice')).toBe(1);
      expect(getRank(board, 'charlie')).toBe(2); // Lowest score
    });

    it('returns undefined for non-existent items', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(getRank(board, 'alice')).toBeUndefined();
    });

    it('updates ranks when scores change', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      expect(getRank(board, 'alice')).toBe(1);

      board = updateScore(board, 'alice', 2000);
      expect(getRank(board, 'alice')).toBe(0); // Now highest
    });
  });

  describe('getTopN', () => {
    it('returns top N items ordered by score', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);
      board = updateScore(board, 'charlie', 1200);
      board = updateScore(board, 'dave', 1600);

      const top2 = getTopN(board, 2);
      expect(top2).toEqual([
        { item: 'bob', score: 1800 },
        { item: 'dave', score: 1600 },
      ]);
    });

    it('handles N larger than leaderboard size', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      const top10 = getTopN(board, 10);
      expect(top10).toHaveLength(2);
    });

    it('returns empty array for empty leaderboard', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(getTopN(board, 5)).toEqual([]);
    });
  });

  describe('getScore', () => {
    it('returns score for existing items', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      expect(getScore(board, 'alice')).toBe(1500);
    });

    it('returns undefined for non-existent items', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(getScore(board, 'alice')).toBeUndefined();
    });
  });

  describe('hasItem', () => {
    it('returns true for existing items', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      expect(hasItem(board, 'alice')).toBe(true);
    });

    it('returns false for non-existent items', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(hasItem(board, 'alice')).toBe(false);
    });
  });

  describe('getAllEntries', () => {
    it('returns all entries ordered by score descending', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'charlie', 1200);
      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      const entries = getAllEntries(board);
      expect(entries).toEqual([
        { item: 'bob', score: 1800 },
        { item: 'alice', score: 1500 },
        { item: 'charlie', score: 1200 },
      ]);
    });

    it('returns empty array for empty leaderboard', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(getAllEntries(board)).toEqual([]);
    });
  });

  describe('getRecentChanges', () => {
    it('returns changes ordered from oldest to newest', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500, 1000);
      board = updateScore(board, 'bob', 1800, 2000);
      board = updateScore(board, 'alice', 1600, 3000);

      const history = getRecentChanges(board);
      expect(history).toHaveLength(3);
      expect(history[0]?.timestamp).toBe(1000);
      expect(history[1]?.timestamp).toBe(2000);
      expect(history[2]?.timestamp).toBe(3000);
    });

    it('respects history buffer capacity (circular)', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 3,
      });

      board = updateScore(board, 'a', 100, 1);
      board = updateScore(board, 'b', 200, 2);
      board = updateScore(board, 'c', 300, 3);
      board = updateScore(board, 'd', 400, 4); // Overwrites oldest

      const history = getRecentChanges(board);
      expect(history).toHaveLength(3);
      expect(history[0]?.item).toBe('b');
      expect(history[1]?.item).toBe('c');
      expect(history[2]?.item).toBe('d');
    });

    it('returns empty array for new leaderboard', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(getRecentChanges(board)).toEqual([]);
    });
  });

  describe('size and isEmpty', () => {
    it('tracks size correctly', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      expect(size(board)).toBe(0);
      expect(isEmpty(board)).toBe(true);

      board = updateScore(board, 'alice', 1500);
      expect(size(board)).toBe(1);
      expect(isEmpty(board)).toBe(false);

      board = updateScore(board, 'bob', 1800);
      expect(size(board)).toBe(2);

      const result = removeItem(board, 'alice');
      expect(size(result.board)).toBe(1);
    });
  });

  describe('isFull', () => {
    it('returns true when at capacity', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 2,
        historySize: 10,
      });

      expect(isFull(board)).toBe(false);

      board = updateScore(board, 'alice', 1500);
      expect(isFull(board)).toBe(false);

      board = updateScore(board, 'bob', 1800);
      expect(isFull(board)).toBe(true);
    });

    it('returns false for unlimited leaderboards', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      expect(isFull(board)).toBe(false);
    });
  });

  describe('validateBoundedLeaderboard', () => {
    it('validates a correct leaderboard', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 5,
      });

      board = updateScore(board, 'alice', 1500);

      const result = validateBoundedLeaderboard(board);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects invalid maxEntries', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 5,
      });

      // Manually corrupt the data
      const corrupted = { ...board, maxEntries: -1 };

      const result = validateBoundedLeaderboard(corrupted);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('invalid_max_entries');
    });

    it('detects size exceeding maxEntries', () => {
      const board = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 5,
      });

      // Manually corrupt the data
      const corrupted = { ...board, size: 15, maxEntries: 10 };

      const result = validateBoundedLeaderboard(corrupted);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('size_exceeds_max');
    });
  });

  describe('complex scenarios', () => {
    it('handles gaming leaderboard use case', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 20,
      });

      // Players join and get scores
      board = updateScore(board, 'player1', 1000);
      board = updateScore(board, 'player2', 1500);
      board = updateScore(board, 'player3', 1200);
      board = updateScore(board, 'player4', 1800);

      // Check top 3
      const top3 = getTopN(board, 3);
      expect(top3).toEqual([
        { item: 'player4', score: 1800 },
        { item: 'player2', score: 1500 },
        { item: 'player3', score: 1200 },
      ]);

      // Player improves score
      board = updateScore(board, 'player1', 2000);
      expect(getRank(board, 'player1')).toBe(0);

      // History tracks all changes
      const history = getRecentChanges(board);
      expect(history.length).toBeGreaterThan(0);
    });

    it('handles bounded leaderboard with eviction', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 3,
        historySize: 10,
      });

      board = updateScore(board, 'a', 100);
      board = updateScore(board, 'b', 200);
      board = updateScore(board, 'c', 300);

      expect(size(board)).toBe(3);

      // Adding higher score evicts lowest
      board = updateScore(board, 'd', 250);
      expect(size(board)).toBe(3);
      expect(hasItem(board, 'a')).toBe(false);
      expect(hasItem(board, 'd')).toBe(true);

      const entries = getAllEntries(board);
      expect(entries).toEqual([
        { item: 'c', score: 300 },
        { item: 'd', score: 250 },
        { item: 'b', score: 200 },
      ]);
    });

    it('handles objects as items', () => {
      type Player = { readonly id: number; readonly name: string };

      let board = createBoundedLeaderboard<Player>({
        maxEntries: 0,
        historySize: 10,
      });

      const player1: Player = { id: 1, name: 'Alice' };
      const player2: Player = { id: 2, name: 'Bob' };

      board = updateScore(board, player1, 1500);
      board = updateScore(board, player2, 1800);

      expect(getRank(board, player1)).toBe(1);
      expect(getScore(board, player2)).toBe(1800);
    });

    it('supports audit trail via history', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 100,
      });

      board = updateScore(board, 'alice', 1000, 1000);
      board = updateScore(board, 'alice', 1100, 2000);
      board = updateScore(board, 'alice', 1200, 3000);

      const history = getRecentChanges(board);
      const aliceChanges = history.filter((change) => change.item === 'alice');

      expect(aliceChanges).toHaveLength(3);
      expect(aliceChanges[0]?.oldScore).toBeUndefined();
      expect(aliceChanges[1]?.oldScore).toBe(1000);
      expect(aliceChanges[2]?.oldScore).toBe(1100);
    });
  });

  describe('immutability', () => {
    it('updateScore does not modify original', () => {
      const original = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 5,
      });

      const modified = updateScore(original, 'alice', 1500);

      expect(size(original)).toBe(0);
      expect(size(modified)).toBe(1);
      expect(getRecentChanges(original)).toEqual([]);
      expect(getRecentChanges(modified)).toHaveLength(1);
    });

    it('removeItem does not modify original', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 10,
        historySize: 5,
      });

      board = updateScore(board, 'alice', 1500);
      board = updateScore(board, 'bob', 1800);

      const originalSize = size(board);
      const result = removeItem(board, 'alice');

      expect(size(board)).toBe(originalSize);
      expect(size(result.board)).toBe(originalSize - 1);
    });
  });

  describe('edge cases', () => {
    it('handles negative scores', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', -100);
      board = updateScore(board, 'bob', 100);
      board = updateScore(board, 'charlie', 0);

      const entries = getAllEntries(board);
      expect(entries[0]?.item).toBe('bob');
      expect(entries[1]?.item).toBe('charlie');
      expect(entries[2]?.item).toBe('alice');
    });

    it('handles floating point scores', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1.5);
      board = updateScore(board, 'bob', 1.2);
      board = updateScore(board, 'charlie', 1.8);

      const top = getTopN(board, 1);
      expect(top[0]?.item).toBe('charlie');
      expect(top[0]?.score).toBe(1.8);
    });

    it('handles very large scores', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', Number.MAX_SAFE_INTEGER);
      board = updateScore(board, 'bob', Number.MIN_SAFE_INTEGER);

      expect(getRank(board, 'alice')).toBe(0);
      expect(getRank(board, 'bob')).toBe(1);
    });

    it('handles single item', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 0,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);

      expect(getRank(board, 'alice')).toBe(0);
      expect(getTopN(board, 1)).toEqual([{ item: 'alice', score: 1500 }]);
      expect(getScore(board, 'alice')).toBe(1500);
    });

    it('handles maxEntries = 1', () => {
      let board = createBoundedLeaderboard<string>({
        maxEntries: 1,
        historySize: 10,
      });

      board = updateScore(board, 'alice', 1500);
      expect(size(board)).toBe(1);

      board = updateScore(board, 'bob', 1800);
      expect(size(board)).toBe(1);
      expect(hasItem(board, 'bob')).toBe(true);
      expect(hasItem(board, 'alice')).toBe(false);
    });
  });
});
