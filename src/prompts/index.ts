import { z } from 'zod';
import type { BulletPointsPrompt, JSONPrompt, RawPrompt } from '~/types';
import buildBulletPointsPrompt from './bulletPoints';
import buildJSONPrompt from './json';

export type PromptKind = 'json' | 'bullet-points';

export const text = (p: string | RawPrompt<string>): RawPrompt<string> =>
  typeof p === 'string' ? { message: p } : p;

export const json = <T extends z.ZodType>(p: JSONPrompt<T>): z.infer<T> => buildJSONPrompt(p);

export const bulletPoints = (p: BulletPointsPrompt): RawPrompt<string[]> =>
  buildBulletPointsPrompt(p);

const test = <T extends z.ZodType>(t: T): z.infer<T> => t.parse({ a: 'b' });
const t = test(z.object({}));
