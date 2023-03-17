import { z } from 'zod';

import type { BooleanPrompt, BulletPointsPrompt, JSONPrompt, RawPrompt } from '~/types';

import buildBooleanPrompt from './boolean';
import buildBulletPointsPrompt from './bulletPoints';
import buildJSONPrompt from './json';

export type PromptKind = 'json' | 'bullet-points';

export const text = (p: string | RawPrompt<string>): RawPrompt<string> =>
  typeof p === 'string' ? { message: p } : p;

export const boolean = (p: BooleanPrompt): RawPrompt<boolean> => buildBooleanPrompt(p);

export const json = <T extends z.ZodType>(p: JSONPrompt<T>): RawPrompt<z.infer<T>> =>
  buildJSONPrompt(p);

export const bulletPoints = (p: BulletPointsPrompt): RawPrompt<string[]> =>
  buildBulletPointsPrompt(p);
