import type { BooleanPrompt, RawPrompt } from 'types';

const truthyValues = ['true', 'yes'];
const falsyValues = ['false', 'no'];
const formatPrompt =
  'Respond to the above statement only with the word "true" or "false", nothing else.';

export default function buildRawPrompt(prompt: BooleanPrompt): RawPrompt<boolean> {
  return {
    message: `${prompt.message}\n${formatPrompt}`,
    parse: async response => {
      // clean up the response a bit, sometimes the model likes to add a period, or make it a full sentence
      const cleaned = response.content
        .replace(/\.|"|'/g, '')
        .toLowerCase()
        .trim();
      if (truthyValues.includes(cleaned)) {
        return { success: true, data: true };
      } else if (falsyValues.includes(cleaned)) {
        return { success: true, data: false };
      } else {
        return { success: false, retryPrompt: formatPrompt };
      }
    },
  };
}
