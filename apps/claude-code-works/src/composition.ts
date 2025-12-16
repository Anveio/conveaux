/**
 * Composition Root
 *
 * Wires up all dependencies for the harness.
 * This is the only place where platform globals (Date, process, crypto) are accessed.
 */

import * as crypto from 'node:crypto';
import type { DurableStorage } from '@conveaux/contract-durable-storage';
import type { Instrumenter } from '@conveaux/contract-instrumentation';
import type { Logger } from '@conveaux/contract-logger';
import { createTraceIdGenerator } from '@conveaux/port-id';
import { createInstrumenter } from '@conveaux/port-instrumentation';
import { createColorEnvironment, createLogger, createPrettyFormatter } from '@conveaux/port-logger';
import { createOutChannel } from '@conveaux/port-outchannel';
import { createRandom } from '@conveaux/port-random';
import { createWallClock } from '@conveaux/port-wall-clock';

import { createNodeSqliteStorage } from './storage/node-sqlite-adapter.js';

/**
 * Runtime dependencies wired at composition time.
 */
export interface RuntimeDeps {
  /** Structured logger for all output */
  readonly logger: Logger;
  /** Instrumenter for tracing and timing */
  readonly instrumenter: Instrumenter;
  /** Project root directory */
  readonly projectRoot: string;
  /** Durable storage for learnings (optional until learning store is implemented) */
  readonly storage?: DurableStorage;
}

/**
 * Options for creating the composition root.
 */
export interface CompositionOptions {
  /** Project root directory */
  readonly projectRoot: string;
  /** Minimum log level (default: 'info') */
  readonly logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Enable colors in output (default: auto-detect) */
  readonly colors?: boolean;
  /** Path to SQLite storage file (default: projectRoot/.claude/learnings.db) */
  readonly storagePath?: string;
  /** Disable storage (for testing or when not needed) */
  readonly disableStorage?: boolean;
}

/**
 * Create all runtime dependencies.
 *
 * This is the composition root - the only place where platform primitives
 * (Date, process, crypto) are accessed directly.
 *
 * @param options - Configuration options
 * @returns Fully wired runtime dependencies
 */
export function createRuntimeDeps(options: CompositionOptions): RuntimeDeps {
  const { projectRoot, logLevel = 'info', colors } = options;

  // Create platform primitives
  const clock = createWallClock({ Date });
  const channel = createOutChannel(process.stderr);
  const random = createRandom({
    randomBytes: (size) => {
      const buffer = crypto.randomBytes(size);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    },
  });

  // Create color environment for NO_COLOR/FORCE_COLOR support
  const colorEnv = createColorEnvironment({
    getEnv: (name) => process.env[name],
    isTTY: () => process.stderr.isTTY ?? false,
  });

  // Create logger with pretty formatter
  const logger = createLogger({
    Date,
    channel,
    clock,
    options: {
      minLevel: logLevel,
      formatter: createPrettyFormatter({
        colors,
        colorEnv,
      }),
    },
  });

  // Create trace ID generator for instrumentation
  const ids = createTraceIdGenerator({ random });

  // Create instrumenter
  const instrumenter = createInstrumenter(
    {
      Date,
      logger,
      clock,
      ids,
    },
    {
      baseContext: {
        component: 'claude-code-works',
      },
    }
  );

  // Create durable storage (optional)
  const storage = options.disableStorage
    ? undefined
    : createNodeSqliteStorage(options.storagePath ?? `${projectRoot}/.claude/learnings.db`);

  return {
    logger,
    instrumenter,
    projectRoot,
    storage,
  };
}
