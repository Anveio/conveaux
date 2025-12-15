/**
 * Token estimation for LLM context.
 * Uses chars/4 approximation which is a reasonable heuristic for English text.
 */

import type { TokenEstimate } from './contracts.js';

/**
 * Estimate the token count of a text string.
 * Uses the chars/4 approximation which is a reasonable heuristic for English text
 * and code. This is intentionally simple - more accurate counting would require
 * a tokenizer, which adds significant complexity and dependencies.
 *
 * @param text - The text to estimate tokens for
 * @returns Token estimate with character count and approximated token count
 */
export function estimateTokens(text: string): TokenEstimate {
  const characterCount = text.length;
  const inputTokens = Math.ceil(characterCount / 4);
  return { inputTokens, characterCount };
}

/**
 * Estimate tokens for combined stdout and stderr output.
 *
 * @param stdout - Standard output text
 * @param stderr - Standard error text
 * @returns Combined token estimate
 */
export function estimateOutputTokens(stdout: string, stderr: string): TokenEstimate {
  const combinedText = stdout + stderr;
  return estimateTokens(combinedText);
}
