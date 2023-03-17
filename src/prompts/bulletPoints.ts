import { compact } from 'lodash';
import { z } from 'zod';

import { BulletPointsPrompt, RawPrompt } from 'types';

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
    'Write the response in bullet points, where each bullet point starts with the - character.',
    prompt.length
      ? `Each bullet point should be less than ${prompt.length} characters long, including white spaces.`
      : undefined,
    prompt.amount ? `There should be exactly ${prompt.amount} bullet points` : undefined,
  ]);

  return buildJSONPrompt({
    initialMessage: prompt.message,
    formatMessage: formatMessages.join(' '),
    parseResponse: res => res.split('\n').map(s => s.replace('-', '').trim()),
    schema: prompt.amount
      ? arraySchema.length(prompt.amount, `There should be exactly ${prompt.amount} bullet points`)
      : arraySchema,
  });
}
