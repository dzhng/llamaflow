import { z } from 'zod';

import buildBooleanPrompt from './boolean';
import buildBulletPointsPrompt from './bulletPoints';
import buildJSONPrompt from './json';

describe('Prompt types', () => {
  it('Should build bullet prompt correctly', () => {
    expect(
      buildBulletPointsPrompt({
        message: 'What are the meanings of life?',
      }),
    ).toMatchSnapshot();

    expect(
      buildBulletPointsPrompt({
        message: 'What are the meanings of life?',
        amount: 10,
      }),
    ).toMatchSnapshot();

    expect(
      buildBulletPointsPrompt({
        message: 'What are the meanings of life?',
        amount: 3,
        length: 140,
      }),
    ).toMatchSnapshot();
  });

  it('Should build boolean prompt correctly', () => {
    expect(
      buildBooleanPrompt({
        message: 'The iPhone 14 was released in 2012',
        promptRetries: 2,
      }),
    ).toMatchSnapshot();
  });

  it('Should build JSON prompt correctly', () => {
    expect(
      buildJSONPrompt({
        message:
          'What are some good baby names? Respond as a JSON array, where each element in the array is one name.',
        schema: z.array(z.string()),
      }),
    ).toMatchSnapshot();
  });
});
