#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { extractShareId, fetchSharePage } from '@conveaux/adapter-http';
import { ConveauxError } from '@conveaux/contracts';
import { convertToMarkdown, parseHTML } from '@conveaux/core';
import chalk from 'chalk';
import { Command } from 'commander';

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
      console.log(chalk.blue('Fetching conversation...'));

      const html = await fetchSharePage(url);

      console.log(chalk.blue('Parsing conversation...'));

      const conversation = parseHTML(html);

      console.log(chalk.blue('Converting to markdown...'));

      const markdown = convertToMarkdown(conversation, {
        includeMetadata: options.metadata,
      });

      // Determine output path
      const shareId = extractShareId(url);
      const outputPath = options.output ?? `conversation-${shareId}.md`;

      await writeFile(outputPath, markdown, 'utf-8');

      console.log(chalk.green(`\nSuccess! Conversation saved to ${chalk.bold(outputPath)}`));
      console.log(chalk.dim(`  Title: ${conversation.title}`));
      console.log(chalk.dim(`  Messages: ${conversation.messages.length}`));
    } catch (error) {
      if (error instanceof ConveauxError) {
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(1);
      }

      if (error instanceof Error) {
        console.error(chalk.red(`\nUnexpected error: ${error.message}`));
        process.exit(1);
      }

      console.error(chalk.red('\nAn unknown error occurred'));
      process.exit(1);
    }
  });

program.parse();
