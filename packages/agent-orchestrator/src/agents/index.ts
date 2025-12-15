/**
 * Pre-configured agent creators for the improvement loop.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Agent,
  readFileTool,
  editFileTool,
  writeFileTool,
  runCommandTool,
  globTool,
  grepTool,
} from '@conveaux/agent-core';

/**
 * Creates an Analyzer agent.
 *
 * The analyzer examines code and identifies improvements.
 * It has read-only access to the filesystem.
 */
export function createAnalyzer(client: Anthropic): Agent {
  return new Agent(client, {
    name: 'analyzer',
    model: 'claude-sonnet-4-5-20250929',
    systemPrompt: `You are a code analyzer. Your job is to examine a package and identify improvements.

Your capabilities:
- Read files to understand the codebase
- Search for patterns with grep
- Find files with glob

Your output should be a JSON array of improvements:
[
  {
    "file": "path/to/file.ts",
    "issue": "Brief description of the issue",
    "fix": "Specific fix to apply",
    "priority": "high" | "medium" | "low"
  }
]

Focus on:
1. Code quality issues (complexity, duplication)
2. Missing tests
3. Type safety improvements
4. Error handling gaps
5. Performance issues

Be specific and actionable. Only suggest improvements you are confident about.`,
    tools: [readFileTool, globTool, grepTool],
    maxIterations: 15,
  });
}

/**
 * Creates an Implementer agent.
 *
 * The implementer makes changes to code based on improvement suggestions.
 * It can read, edit, and create files.
 */
export function createImplementer(client: Anthropic): Agent {
  return new Agent(client, {
    name: 'implementer',
    model: 'claude-sonnet-4-5-20250929',
    systemPrompt: `You are a code implementer. Your job is to apply improvements to a codebase.

Your capabilities:
- Read files to understand context
- Edit files with precise string replacement
- Create new files when needed

Guidelines:
1. Follow existing code patterns and style
2. Make minimal, focused changes
3. Add tests for new functionality
4. Ensure imports are correct
5. Don't break existing functionality

When editing files:
- The old_string must be unique in the file
- Include enough context to make the match unique
- Preserve existing indentation

Report what changes you made when done.`,
    tools: [readFileTool, editFileTool, writeFileTool],
    maxIterations: 20,
  });
}

/**
 * Creates a Reviewer agent.
 *
 * The reviewer runs verification and checks for regressions.
 * It can run commands and read files.
 */
export function createReviewer(client: Anthropic): Agent {
  return new Agent(client, {
    name: 'reviewer',
    model: 'claude-sonnet-4-5-20250929',
    systemPrompt: `You are a code reviewer. Your job is to verify that changes work correctly.

Your capabilities:
- Run shell commands (tests, linters, builds)
- Read files to inspect changes

Your workflow:
1. Run the verification pipeline: ./verify.sh --ui=false
2. If it fails, analyze the error output
3. Report whether verification passed or failed

Output format:
- If passed: "VERIFICATION:PASS" followed by a summary
- If failed: "VERIFICATION:FAIL" followed by error details

Be thorough but concise in your reporting.`,
    tools: [runCommandTool, readFileTool],
    maxIterations: 10,
  });
}
