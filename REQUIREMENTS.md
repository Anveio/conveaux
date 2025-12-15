# Requirements

## Problem

Users want to export and preserve their AI conversations (starting with ChatGPT) as readable, portable markdown files. Currently, share links are ephemeral and the content is locked in platform-specific formats that are difficult to archive, search, or reference later.

## Goals

- Convert public ChatGPT share links to clean markdown files
- Preserve code blocks, formatting, and conversation structure
- Provide clear error messages for common failure modes (404, invalid URL, network issues)
- Support custom output filenames via CLI flag
- Fast execution (under 2 seconds for typical conversations)

## Non-Goals

- Authentication or private conversation access
- Real-time sync or watch mode
- Browser extension
- Support for Claude/Gemini/other platforms (future enhancement)
- Batch conversion of multiple URLs in single command

## Constraints

- No runtime `any` types outside test files (per project conventions)
- No headless browser - parse HTML directly using Cheerio
- Node.js 22+ required
- Must work with both `chatgpt.com/share/*` and `chat.openai.com/share/*` URLs

## Acceptance Criteria

- [ ] Valid ChatGPT share URL converts to markdown file
- [ ] Code blocks in conversation are preserved with language hints
- [ ] Invalid/404 URLs show clear, actionable error messages
- [ ] CLI exits 0 on success, 1 on error
- [ ] `--output` flag works for custom filenames
- [ ] `--no-metadata` flag omits header metadata
- [ ] `./verify.sh --ui=false` passes

## Glossary

| Term | Definition |
|------|------------|
| Share link | Public URL like `https://chatgpt.com/share/abc123` |
| `__NEXT_DATA__` | Script tag in ChatGPT pages containing conversation JSON |
| Living document | Files that steer work over time (REQUIREMENTS.md, MILESTONE.md) |
| Verification gate | `./verify.sh --ui=false` must exit 0 for work to be "done" |

## Open Questions

- Should legacy `chat.openai.com` URLs redirect or be handled directly?
- Should metadata header be on by default or opt-in?
