import type { BooleanPrompt, RawPrompt } from '../types';

const truthyValues = ['true', 'yes'];
const falsyValues = ['false', 'no'];
const formatPrompt =
  'Respond to the below prompt only with the word "true" or "false", nothing else.';

export default function buildRawPrompt(prompt: BooleanPrompt): RawPrompt<boolean> {
  return {
    message: `${formatPrompt}\n\n${prompt.message}`,
    parse: async response => {
      // clean up the response a bit, sometimes the model likes to add a period, or make it a full sentence
      const cleaned = response.content
        .replace(/\.|"|'/g, '')
        .toLowerCase()
        .trim()
        .split(' ')[0]; // do split here to get rid of unnecessary prose the model sometimes adds

      if (truthyValues.includes(cleaned)) {
        return { success: true, data: true };
      } else if (falsyValues.includes(cleaned)) {
        return { success: true, data: false };
      } else {
        return {
          success: false,
          retryPrompt:
            'Respond to the prompt above with only the word "true" or "false", nothing else.',
        };
      }
    },
  };
}
