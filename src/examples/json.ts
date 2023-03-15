import { z } from 'zod'; // JSONPrompt uses Zod for schema validation.
import { OpenAI, prompt } from '~/index';

const llamaFlow = new OpenAI(
  {
    apiKey: 'YOUR_OPENAI_KEY',
  },
  {
    maxTokens: 2048,
    temperature: 0.7,
  },
);

const bulletPrompt = prompt.json({
  initialMessage: 'Please rewrite this in a list of bullet points.',
  formatMessage:
    'Respond as a JSON array, where each element in the array is one bullet point. Keep each bullet point to be 200 characters max. For example: ["bullet point 1", "bullet point 2"]',
  schema: z.array(z.string().max(200)),
});
