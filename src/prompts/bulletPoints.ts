import { compact } from 'lodash';
import { z } from 'zod';

import { BulletPointsPrompt, RawPrompt } from '../types';

import buildJSONPrompt from './json';

export default function buildRawPrompt(prompt: BulletPointsPrompt): RawPrompt<string[]> {
  const arraySchema = z.array(
    prompt.length
      ? z
          .string()
          .max(
            prompt.length,
            `Each bullet point should be less than ${prompt.length} characters, including white spaces.`,
          )
      : z.string(),
  );

  const formatMessages = compact([
    "Respond to the prompt below in bullet points, where each bullet point starts with the - character. Don't include any other text other than the bullet points.",
    prompt.length
      ? `Each bullet point should be less than ${prompt.length} characters long, including white spaces.`
      : undefined,
    prompt.amount
      ? `There should be exactly ${prompt.amount} bullet points, no more or less.`
      : undefined,
  ]);

  return buildJSONPrompt({
    message: `${formatMessages.join(' ')}\n\n${prompt.message}`,

    // parse by splitting the returned text into individual lines, then filtering out the non-bulletpoint lines (sometimes the LLM will still return some other text, like an title or explaination).
    parseResponse: res =>
      res
        .split('\n')
        .filter(s => s.includes('-'))
        .map(s => s.replace('-', '').trim()),

    schema: prompt.amount
      ? arraySchema.length(
          prompt.amount,
          `There should be exactly ${prompt.amount} bullet points, no more or less.`,
        )
      : arraySchema,
  });
}
