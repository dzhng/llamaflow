import { z } from 'zod';
import type { BulletPointsPrompt, JSONPrompt, Prompt, RawPrompt } from '~/types';
import buildBulletPointsPrompt from './bulletPoints';
import buildJSONPrompt from './json';

export type PromptKind = 'json' | 'bullet-points';

export interface PromptInternal<T extends PromptKind> {
  _kind: T;
}

export const raw = (p: RawPrompt) => p;
export const json = (p: JSONPrompt) =>
  buildJSONPrompt<z.infer<typeof p.schema>>({ ...p, _kind: 'json' });
export const bulletPoints = (p: BulletPointsPrompt) =>
  buildBulletPointsPrompt({ ...p, _kind: 'bullet-points' });

export function coerceToRawPrompt<T>(prompt: Prompt<T>): RawPrompt<T> {
  const coercedPrompt = typeof prompt === 'string' ? { message: prompt } : prompt;
  return coercedPrompt;
}
