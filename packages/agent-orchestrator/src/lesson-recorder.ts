/**
 * Records lessons learned to instructions/improvements/lessons.md
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Environment,
  LessonLearned,
  Logger,
  Random,
  WallClock,
} from '@conveaux/agent-contracts';

/**
 * Path to the lessons file relative to project root.
 */
const LESSONS_PATH = 'instructions/improvements/lessons.md';

/**
 * Ports needed for lesson recording.
 */
interface LessonRecorderPorts {
  clock: WallClock;
  random: Random;
  env: Environment;
  logger: Logger;
}

/**
 * Generate a unique lesson ID using injected ports.
 */
function generateLessonId(clock: WallClock, random: Random): string {
  const date = new Date(clock.nowMs()).toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = random.number().toString(36).slice(2, 6);
  return `L-${date}-${randomPart}`;
}

/**
 * Format a lesson as markdown.
 */
function formatLesson(lesson: LessonLearned): string {
  return `
### ${lesson.id}: Agent Improvement

**Date**: ${lesson.date}
**Context**: ${lesson.context}
**Lesson**: ${lesson.lesson}
**Evidence**: ${lesson.evidence}
`;
}

/**
 * Record a lesson learned during an improvement iteration.
 */
export async function recordLesson(params: {
  context: string;
  lesson: string;
  evidence: string;
  ports: LessonRecorderPorts;
  projectRoot?: string;
}): Promise<LessonLearned> {
  const { context, lesson, evidence, ports, projectRoot } = params;
  const { clock, random, env, logger } = ports;

  const resolvedRoot = projectRoot ?? env.cwd();

  const lessonData: LessonLearned = {
    id: generateLessonId(clock, random),
    date: new Date(clock.nowMs()).toISOString().slice(0, 10),
    context,
    lesson,
    evidence,
  };

  const lessonsPath = join(resolvedRoot, LESSONS_PATH);

  try {
    // Read existing content
    let content = await readFile(lessonsPath, 'utf-8');

    // Find the "## Lessons by Domain" section and append
    const sectionMarker = '## Lessons by Domain';
    const sectionIndex = content.indexOf(sectionMarker);

    if (sectionIndex !== -1) {
      // Insert after the section header and any existing content
      const afterSection = content.slice(sectionIndex + sectionMarker.length);
      const beforeSection = content.slice(0, sectionIndex + sectionMarker.length);

      content = `${beforeSection}\n${formatLesson(lessonData)}${afterSection}`;
    } else {
      // Append to end if section not found
      content += `\n${formatLesson(lessonData)}`;
    }

    await writeFile(lessonsPath, content, 'utf-8');

    return lessonData;
  } catch (error) {
    // If file doesn't exist, that's okay - lessons are optional
    logger.warn(`Could not record lesson: ${error}`);
    return lessonData;
  }
}
