import { z } from 'zod';
import type { JSONPrompt, RawPrompt } from '~/types';
import buildBulletPointsPrompt from './bulletPoints';
import buildJSONPrompt from './json';

export const raw = (p: RawPrompt) => p;
export const json = (p: JSONPrompt) => buildJSONPrompt<z.infer<typeof p.schema>>(p);
export const bulletPoints = buildBulletPointsPrompt;
