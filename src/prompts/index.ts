import { z } from 'zod';
import type { BulletPointsPrompt, JSONPrompt, RawPrompt } from '~/types';
import buildBulletPointsPrompt from './bulletPoints';
import buildJSONPrompt from './json';

export type PromptKind = 'json' | 'bullet-points';

export type PromptReturnType<T> = T extends string
  ? string
  : T extends BulletPointsPrompt
  ? string[]
  : T extends JSONPrompt
  ? z.infer<T['schema']>
  : unknown;

export interface PromptInternal<T extends PromptKind> {
  _kind: T;
}

export const raw = (p: RawPrompt) => p;

export const json = (p: JSONPrompt) =>
  buildJSONPrompt<z.infer<typeof p.schema>>({ ...p, _kind: 'json' });

export const bulletPoints = (p: BulletPointsPrompt) =>
  buildBulletPointsPrompt({ ...p, _kind: 'bullet-points' });
