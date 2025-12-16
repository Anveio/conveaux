import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DurableStorage } from '@conveaux/contract-durable-storage';

import { createInMemoryStorage } from '../storage/node-sqlite-adapter.js';
import { type HumanInputStore, createHumanInputStore } from './index.js';

describe('HumanInputStore', () => {
  let storage: DurableStorage;
  let store: HumanInputStore;
  let sessionCounter: number;

  beforeEach(() => {
    storage = createInMemoryStorage();
    sessionCounter = 0;
    store = createHumanInputStore({
      storage,
      generateId: () => `test-session-${++sessionCounter}`,
    });
  });

  afterEach(() => {
    if (storage.isOpen) {
      storage.close();
    }
  });

  describe('migrations', () => {
    it('should apply migrations on creation', () => {
      expect(storage.getSchemaVersion()).toBe(1);
    });
  });

  describe('session management', () => {
    it('should start with no active session', () => {
      expect(store.getCurrentSession()).toBeNull();
    });

    it('should create session on startSession', () => {
      const sessionId = store.startSession();
      expect(sessionId).toBe('test-session-1');
      expect(store.getCurrentSession()).toBe('test-session-1');
    });

    it('should auto-create session on first recordInput', () => {
      expect(store.getCurrentSession()).toBeNull();

      store.recordInput({
        inputText: 'Hello',
        contextType: 'prompt',
      });

      expect(store.getCurrentSession()).toBe('test-session-1');
    });

    it('should reset sequence on new session', () => {
      store.startSession();
      store.recordInput({ inputText: 'First', contextType: 'prompt' });
      store.recordInput({ inputText: 'Second', contextType: 'prompt' });

      const session1Inputs = store.getInputsBySession('test-session-1');
      expect(session1Inputs[0]!.sequenceNum).toBe(1);
      expect(session1Inputs[1]!.sequenceNum).toBe(2);

      store.startSession();
      store.recordInput({ inputText: 'New session', contextType: 'prompt' });

      const session2Inputs = store.getInputsBySession('test-session-2');
      expect(session2Inputs[0]!.sequenceNum).toBe(1);
    });
  });

  describe('recordInput', () => {
    it('should record and return human input', () => {
      const input = store.recordInput({
        inputText: 'Fix the type error in utils.ts',
        contextType: 'correction',
        agentPhase: 'coding',
        featureId: 'F001',
      });

      expect(input.id).toBe(1);
      expect(input.inputText).toBe('Fix the type error in utils.ts');
      expect(input.contextType).toBe('correction');
      expect(input.agentPhase).toBe('coding');
      expect(input.featureId).toBe('F001');
      expect(input.sequenceNum).toBe(1);
    });

    it('should increment sequence numbers', () => {
      const input1 = store.recordInput({ inputText: 'First', contextType: 'prompt' });
      const input2 = store.recordInput({ inputText: 'Second', contextType: 'prompt' });
      const input3 = store.recordInput({ inputText: 'Third', contextType: 'decision' });

      expect(input1.sequenceNum).toBe(1);
      expect(input2.sequenceNum).toBe(2);
      expect(input3.sequenceNum).toBe(3);
    });

    it('should handle null optional fields', () => {
      const input = store.recordInput({
        inputText: 'Simple prompt',
        contextType: 'other',
      });

      expect(input.agentPhase).toBeNull();
      expect(input.featureId).toBeNull();
    });
  });

  describe('getInputs', () => {
    beforeEach(() => {
      store.recordInput({
        inputText: 'Prompt 1',
        contextType: 'prompt',
        agentPhase: 'initializer',
      });
      store.recordInput({
        inputText: 'Correction 1',
        contextType: 'correction',
        agentPhase: 'coding',
      });
      store.recordInput({ inputText: 'Prompt 2', contextType: 'prompt', agentPhase: 'coding' });
      store.recordInput({
        inputText: 'Decision 1',
        contextType: 'decision',
        agentPhase: 'reviewer',
      });
    });

    it('should return all inputs without filters', () => {
      const inputs = store.getInputs();
      expect(inputs).toHaveLength(4);
    });

    it('should filter by context type', () => {
      const prompts = store.getInputs({ contextType: 'prompt' });
      expect(prompts).toHaveLength(2);
      expect(prompts.every((i) => i.contextType === 'prompt')).toBe(true);
    });

    it('should filter by agent phase', () => {
      const codingInputs = store.getInputs({ agentPhase: 'coding' });
      expect(codingInputs).toHaveLength(2);
      expect(codingInputs.every((i) => i.agentPhase === 'coding')).toBe(true);
    });

    it('should filter by session', () => {
      store.startSession();
      store.recordInput({ inputText: 'New session input', contextType: 'prompt' });

      const session1Inputs = store.getInputs({ sessionId: 'test-session-1' });
      const session2Inputs = store.getInputs({ sessionId: 'test-session-2' });

      expect(session1Inputs).toHaveLength(4);
      expect(session2Inputs).toHaveLength(1);
    });

    it('should respect limit', () => {
      const limited = store.getInputs({ limit: 2 });
      expect(limited).toHaveLength(2);
    });
  });

  describe('getRecentInputs', () => {
    it('should return most recent inputs', () => {
      store.recordInput({ inputText: 'Old', contextType: 'prompt' });
      store.recordInput({ inputText: 'Middle', contextType: 'prompt' });
      store.recordInput({ inputText: 'Recent', contextType: 'prompt' });

      const recent = store.getRecentInputs(2);
      expect(recent).toHaveLength(2);
      // Most recent first
      expect(recent[0]!.inputText).toBe('Recent');
      expect(recent[1]!.inputText).toBe('Middle');
    });

    it('should default to 10 results', () => {
      for (let i = 0; i < 15; i++) {
        store.recordInput({ inputText: `Input ${i}`, contextType: 'prompt' });
      }

      const recent = store.getRecentInputs();
      expect(recent).toHaveLength(10);
    });
  });

  describe('getInputsBySession', () => {
    it('should return inputs ordered by sequence', () => {
      store.recordInput({ inputText: 'First', contextType: 'prompt' });
      store.recordInput({ inputText: 'Second', contextType: 'correction' });
      store.recordInput({ inputText: 'Third', contextType: 'decision' });

      const inputs = store.getInputsBySession('test-session-1');

      expect(inputs).toHaveLength(3);
      expect(inputs[0]!.inputText).toBe('First');
      expect(inputs[1]!.inputText).toBe('Second');
      expect(inputs[2]!.inputText).toBe('Third');
    });

    it('should return empty array for unknown session', () => {
      store.recordInput({ inputText: 'Test', contextType: 'prompt' });

      const inputs = store.getInputsBySession('nonexistent-session');
      expect(inputs).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should count inputs', () => {
      expect(store.getInputCount()).toBe(0);

      store.recordInput({ inputText: 'One', contextType: 'prompt' });
      expect(store.getInputCount()).toBe(1);

      store.recordInput({ inputText: 'Two', contextType: 'prompt' });
      expect(store.getInputCount()).toBe(2);
    });

    it('should count sessions', () => {
      expect(store.getSessionCount()).toBe(0);

      store.recordInput({ inputText: 'Session 1', contextType: 'prompt' });
      expect(store.getSessionCount()).toBe(1);

      store.startSession();
      store.recordInput({ inputText: 'Session 2', contextType: 'prompt' });
      expect(store.getSessionCount()).toBe(2);
    });
  });

  describe('data persistence', () => {
    it('should persist inputs across store instances', () => {
      // Record in first store instance
      store.recordInput({ inputText: 'Persisted input', contextType: 'prompt' });

      // Create new store instance with same storage
      const store2 = createHumanInputStore({
        storage,
        generateId: () => `test-session-${++sessionCounter}`,
      });

      // Verify data persisted
      const inputs = store2.getRecentInputs();
      expect(inputs).toHaveLength(1);
      expect(inputs[0]!.inputText).toBe('Persisted input');
    });
  });
});
