#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import {
  convertToMarkdown,
  extractShareId,
  fetchSharePage,
  parseHTML,
} from '@conveaux/chatgpt-share';
import { ConveauxError } from '@conveaux/contract-error';
import { createLogger, createPrettyFormatter } from '@conveaux/port-logger';
import { createOutChannel } from '@conveaux/port-outchannel';
import { createWallClock } from '@conveaux/port-wall-clock';
import { Command } from 'commander';

// Composition root: inject platform globals here
const clock = createWallClock({ Date });
const logger = createLogger({
  Date,
  channel: createOutChannel(process.stderr),
  clock,
  options: {
    formatter: createPrettyFormatter({ colors: true }),
  },
});

// Dependencies for chatgpt-share functions
const fetchDeps = { AbortController, setTimeout, clearTimeout };
const parseDeps = { Date };

const program = new Command();

program
  .name('conveaux')
  .description('Convert ChatGPT share links to markdown files')
  .version('0.1.0')
  .argument('<url>', 'ChatGPT share URL')
  .option('-o, --output <path>', 'Output file path')
  .option('--no-metadata', 'Exclude metadata header from output')
  .action(async (url: string, options: { output?: string; metadata: boolean }) => {
    try {
      logger.info('Fetching conversation...');

      const html = await fetchSharePage(fetchDeps, url, globalThis.fetch);

      logger.info('Parsing conversation...');

      const conversation = parseHTML(parseDeps, html);

      logger.info('Converting to markdown...');

      const markdown = convertToMarkdown(conversation, {
        includeMetadata: options.metadata,
      });

      // Determine output path
      const shareId = extractShareId(url);
      const outputPath = options.output ?? `conversation-${shareId}.md`;

      await writeFile(outputPath, markdown, 'utf-8');

      logger.info('Success!', {
        outputPath,
        title: conversation.title,
        messageCount: conversation.messages.length,
      });
    } catch (error) {
      if (error instanceof ConveauxError) {
        logger.error(error.message, { error });
        process.exit(1);
      }

      if (error instanceof Error) {
        logger.error('Unexpected error', { error });
        process.exit(1);
      }

      logger.fatal('An unknown error occurred');
      process.exit(1);
    }
  });

program.parse();
