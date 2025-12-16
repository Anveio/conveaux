import { describe, expect, it } from 'vitest';

import {
  createEnv,
  createOverrideEnvSource,
  createShellEnvSource,
  createStaticEnvSource,
} from './index.js';

// =============================================================================
// Source Factory Tests
// =============================================================================

describe('createShellEnvSource', () => {
  it('should read from getEnv function', () => {
    const source = createShellEnvSource({
      getEnv: (key) => (key === 'FOO' ? 'bar' : undefined),
    });

    expect(source.get('FOO')).toBe('bar');
    expect(source.get('BAZ')).toBeUndefined();
  });

  it('should use default name and priority', () => {
    const source = createShellEnvSource({ getEnv: () => undefined });
    expect(source.name).toBe('shell');
    expect(source.priority).toBe(10);
  });

  it('should allow custom name and priority', () => {
    const source = createShellEnvSource(
      { getEnv: () => undefined },
      { name: 'process.env', priority: 15 }
    );
    expect(source.name).toBe('process.env');
    expect(source.priority).toBe(15);
  });
});

describe('createStaticEnvSource', () => {
  it('should return static values', () => {
    const source = createStaticEnvSource({
      AWS_REGION: 'us-east-1',
      LOG_LEVEL: 'debug',
    });

    expect(source.get('AWS_REGION')).toBe('us-east-1');
    expect(source.get('LOG_LEVEL')).toBe('debug');
    expect(source.get('UNKNOWN')).toBeUndefined();
  });

  it('should use default name and priority', () => {
    const source = createStaticEnvSource({});
    expect(source.name).toBe('static');
    expect(source.priority).toBe(0);
  });

  it('should allow custom name and priority', () => {
    const source = createStaticEnvSource({}, { name: 'defaults', priority: 5 });
    expect(source.name).toBe('defaults');
    expect(source.priority).toBe(5);
  });
});

describe('createOverrideEnvSource', () => {
  it('should return override values', () => {
    const source = createOverrideEnvSource({
      AWS_REGION: 'eu-west-1',
    });

    expect(source.get('AWS_REGION')).toBe('eu-west-1');
  });

  it('should return empty string for null (explicit unset)', () => {
    const source = createOverrideEnvSource({
      AWS_PROFILE: null,
    });

    expect(source.get('AWS_PROFILE')).toBe('');
  });

  it('should return undefined for keys not in overrides', () => {
    const source = createOverrideEnvSource({
      AWS_REGION: 'eu-west-1',
    });

    expect(source.get('LOG_LEVEL')).toBeUndefined();
  });

  it('should distinguish undefined value from missing key', () => {
    // Key explicitly set to undefined should fall through
    const source = createOverrideEnvSource({
      EXPLICIT_UNDEFINED: undefined,
    });

    // Key is present but value is undefined - should return undefined (fall through)
    expect(source.get('EXPLICIT_UNDEFINED')).toBeUndefined();
    // Key is not present - should also return undefined (fall through)
    expect(source.get('NOT_PRESENT')).toBeUndefined();
  });

  it('should use default name and priority', () => {
    const source = createOverrideEnvSource({});
    expect(source.name).toBe('override');
    expect(source.priority).toBe(100);
  });

  it('should allow custom name and priority', () => {
    const source = createOverrideEnvSource({}, { name: 'cli', priority: 200 });
    expect(source.name).toBe('cli');
    expect(source.priority).toBe(200);
  });
});

// =============================================================================
// Env Resolver Tests
// =============================================================================

describe('createEnv', () => {
  describe('priority-based resolution', () => {
    it('should return value from highest priority source', () => {
      const env = createEnv({
        sources: [
          createStaticEnvSource({ FOO: 'low' }, { priority: 0 }),
          createStaticEnvSource({ FOO: 'high' }, { priority: 100 }),
        ],
      });

      expect(env.get('FOO')).toBe('high');
    });

    it('should fall through to lower priority when higher returns undefined', () => {
      const env = createEnv({
        sources: [
          createStaticEnvSource({ DEFAULT: 'value' }, { priority: 0 }),
          createStaticEnvSource({}, { priority: 100 }),
        ],
      });

      expect(env.get('DEFAULT')).toBe('value');
    });

    it('should return undefined when no source has the key', () => {
      const env = createEnv({
        sources: [createStaticEnvSource({ FOO: 'bar' }, { priority: 0 })],
      });

      expect(env.get('UNKNOWN')).toBeUndefined();
    });

    it('should sort sources by priority at creation time', () => {
      // Pass sources in wrong order
      const env = createEnv({
        sources: [
          createStaticEnvSource({ FOO: 'low' }, { priority: 10 }),
          createStaticEnvSource({ FOO: 'high' }, { priority: 50 }),
          createStaticEnvSource({ FOO: 'medium' }, { priority: 30 }),
        ],
      });

      expect(env.get('FOO')).toBe('high');
    });

    it('should handle empty sources array', () => {
      const env = createEnv({ sources: [] });
      expect(env.get('ANY_KEY')).toBeUndefined();
    });

    it('should handle sources with equal priority (first registered wins)', () => {
      const env = createEnv({
        sources: [
          createStaticEnvSource({ FOO: 'first' }, { priority: 50 }),
          createStaticEnvSource({ FOO: 'second' }, { priority: 50 }),
        ],
      });

      // With equal priority, stable sort preserves order - first one wins
      // Note: depends on sort stability, which is guaranteed in modern JS
      expect(env.get('FOO')).toBe('first');
    });
  });

  describe('three-state override semantics', () => {
    it('should shadow lower sources with null override', () => {
      const env = createEnv({
        sources: [
          createStaticEnvSource({ AWS_PROFILE: 'production' }, { priority: 0 }),
          createOverrideEnvSource({ AWS_PROFILE: null }, { priority: 100 }),
        ],
      });

      // null becomes empty string, which is defined, so it wins
      expect(env.get('AWS_PROFILE')).toBe('');
    });

    it('should allow override with new value', () => {
      const env = createEnv({
        sources: [
          createStaticEnvSource({ AWS_REGION: 'us-east-1' }, { priority: 0 }),
          createOverrideEnvSource({ AWS_REGION: 'eu-west-1' }, { priority: 100 }),
        ],
      });

      expect(env.get('AWS_REGION')).toBe('eu-west-1');
    });

    it('should fall through when override key not present', () => {
      const env = createEnv({
        sources: [
          createStaticEnvSource({ LOG_LEVEL: 'info' }, { priority: 0 }),
          createOverrideEnvSource({ AWS_REGION: 'eu-west-1' }, { priority: 100 }),
        ],
      });

      expect(env.get('LOG_LEVEL')).toBe('info');
    });
  });
});

// =============================================================================
// Integration Tests (AWS CLI Use Case)
// =============================================================================

describe('AWS CLI integration pattern', () => {
  it('should resolve from CLI flags > profile > shell > defaults', () => {
    // Simulated AWS CLI tool environment
    const cliFlags: Record<string, string | null | undefined> = {
      // User passed --region eu-west-1
      AWS_REGION: 'eu-west-1',
      // User passed --no-profile (explicit unset)
      AWS_PROFILE: null,
    };

    const profileConfig = {
      // From ~/.aws/config
      AWS_REGION: 'ap-southeast-1',
      AWS_DEFAULT_OUTPUT: 'json',
    };

    const shellEnv: Record<string, string> = {
      // From shell
      AWS_REGION: 'us-west-2',
      HOME: '/home/user',
    };

    const defaults = {
      AWS_REGION: 'us-east-1',
      AWS_DEFAULT_OUTPUT: 'text',
      LOG_LEVEL: 'warn',
    };

    const env = createEnv({
      sources: [
        createOverrideEnvSource(cliFlags, { name: 'cli', priority: 100 }),
        createStaticEnvSource(profileConfig, { name: 'profile', priority: 50 }),
        createShellEnvSource({ getEnv: (k) => shellEnv[k] }, { name: 'shell', priority: 10 }),
        createStaticEnvSource(defaults, { name: 'defaults', priority: 0 }),
      ],
    });

    // CLI wins for AWS_REGION
    expect(env.get('AWS_REGION')).toBe('eu-west-1');

    // CLI explicitly unset AWS_PROFILE (null -> empty string)
    expect(env.get('AWS_PROFILE')).toBe('');

    // Profile wins for AWS_DEFAULT_OUTPUT (CLI didn't specify)
    expect(env.get('AWS_DEFAULT_OUTPUT')).toBe('json');

    // Shell wins for HOME (higher than defaults)
    expect(env.get('HOME')).toBe('/home/user');

    // Defaults wins for LOG_LEVEL (nothing else has it)
    expect(env.get('LOG_LEVEL')).toBe('warn');

    // Unknown returns undefined
    expect(env.get('UNKNOWN_VAR')).toBeUndefined();
  });
});
