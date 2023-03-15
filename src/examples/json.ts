import { z } from 'zod'; // JSONPrompt uses Zod for schema validation.
import { prompt } from '~/index';

const bulletPrompt = prompt.json({
  initialMessage: 'Please rewrite this in a list of bullet points.',
  formatMessage:
    'Respond as a JSON array, where each element in the array is one bullet point. Keep each bullet point to be 200 characters max. For example: ["bullet point 1", "bullet point 2"]',
  schema: z.array(z.string().max(200)),
});
