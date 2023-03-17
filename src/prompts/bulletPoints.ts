import { z } from 'zod';
import { BulletPointsPrompt, RawPrompt } from '~/types';
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

  return buildJSONPrompt({
    initialMessage: prompt.message,
    formatMessage:
      'Write the response in bullet points, where each bullet point starts with the - character.' +
      prompt.length
        ? ` Each bullet point should be less than ${prompt.length} characters long, including white spaces.`
        : '' + prompt.amount
        ? ` There should be exactly ${prompt.amount} bullet points`
        : '',
    parseResponse: res => res.split('\n').map(s => s.replace('-', '').trim()),
    schema: prompt.amount
      ? arraySchema.length(prompt.amount, `There should be exactly ${prompt.amount} bullet points`)
      : arraySchema,
  });
}
