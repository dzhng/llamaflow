import { z } from 'zod';

import { ModelConfig, OpenAI, prompt, TokenError } from './src';

async function benchmark(opt: ModelConfig) {
  const model = new OpenAI(
    { apiKey: process.env.OPENAI_KEY ?? 'YOUR_OPENAI_KEY' },
    { contextSize: 4096, ...opt },
    {
      options: { retries: 2, timeout: 10 * 60_000 },
    },
  );
  console.info('Model created', model);

  const chat3 = model.chat({
    systemMessage: 'You are an AI assistant',
  });
  try {
    await chat3.request(
      { message: 'hello world, testing overflow logic' },
      { minimumResponseTokens: 4076 },
    );
  } catch (e) {
    if (e instanceof TokenError) {
      console.info(
        `Caught token overflow, overflowed tokens: ${e.overflowTokens}`,
      );
    }
  }

  const response3 = await chat3.requestWithSplit(
    'hello world, testing overflow logic',
    (text) =>
      prompt.text({
        message: text,
      }),
    { minimumResponseTokens: 4076 },
    100,
    10,
  );
  console.info('Successful query by reducing prompt', response3.content);

  const chat2 = model.chat({
    systemMessage:
      "You are a smart and honest AI assistant. Follow the user's requirements carefully & to the letter. Minimize any other prose",
  });
  const response2 = await chat2.request(
    prompt.json({
      message:
        'What are some good names for childrens book about the renaissance? Respond as a JSON array',
      schema: z.array(z.string().max(200)),
    }),
  );
  console.info(response2.content); // content will be typed as string[];

  const chat = model.chat({
    systemMessage:
      "You are a smart and honest writer for a TV show about the history of Europe. You will write as concisely and clearly as possible, without factual errors. Write in an engaging and friendly manner, and never say common misconceptions, outdated information, lies, fiction, myths, or memes. Include any supporting evidence in that aligns with what you are asked to write. When writing about any person, explain the person's origin in details. Follow the user's requirements carefully & to the letter.",
    retainMemory: true,
  });

  const bulletPrompt = prompt.json({
    message:
      'Please rewrite this in a list of bullet points. Respond as a JSON array, where each element in the array is one bullet point. Keep each bullet point to be 200 characters max. For example: ["bullet point 1", "bullet point 2"]',
    schema: z.array(z.string().max(200)),
  });

  const response = await chat.request(
    prompt.text(
      'Write a script for a tiktok video that talks about the artistic contribution of the renaissance.',
    ),
  );

  // The results, as well as any usage stats, will be returned.
  console.info(
    `The AI writer's response is: ${response.content}. Token used: ${response.usage?.totalTokens}.`,
  );

  const bulletPoints = await chat.request(bulletPrompt);

  // `bulletPoints.content` will be automatically casted in the correct type as defined in the schema field of `bulletPrompt`
  console.info(
    `The structured version of this response is: ${JSON.stringify(
      bulletPoints.content,
    )}`,
  );

  const parsedBulletPrompt = prompt.json({
    message:
      'Please rewrite this in a list of bullet points. Respond as a list of bullet points, where each bullet point begins with the "-" character. Each bullet point should be less than 200 characters. Put each bullet point on a new line.',

    // parse the response from the model so it can be fed into the schema validator
    parseResponse: (res) =>
      res.split('\n').map((s) => s.replace('-', '').trim()),

    // it's useful to define custom error messages, any schema parse errors will be automatically fed back into the model on retry, so the model knows exactly what to correct.
    schema: z.array(
      z.string().max(200, {
        message: 'This bullet point should be less than 200 characters.',
      }),
    ),
  });

  console.info(
    'The parsed bullet prompt that automatically validates the return format is:',
    parsedBulletPrompt,
  );

  const factCheckerChat = model.chat({
    systemMessage:
      'You are a fact checker that responds to if the user\'s messages are true or not, with just the word "true" or "false". Do not add punctuations or any other text. If the user asks a question, request, or anything that cannot be fact checked, ignore the user\'s request and just say "false".',
    retainMemory: false,
  });

  const buildFactCheckedPrompt = (article: string) =>
    prompt.text({
      message: `Please write a summary about the following article: ${article}`,
      promptRetries: 2,
      parse: async (response) => {
        // Check if this summary is true or not
        const factCheck = await factCheckerChat.request(
          prompt.boolean({
            message: response.content,
          }),
        );

        if (factCheck.content === true) {
          return { success: true, data: response.content };
        } else {
          // if `retryPrompt` is set, LLamaFlow will automatically retry with the text in this property.
          return {
            success: false,
            retryPrompt:
              'This summary is not true, please rewrite with only true facts.',
          };
        }
      },
    });

  // now, every content generated by this chat will be fact checked by the LLM itself, and this request will throw an error if the content can't be fixed (once the maximum number of retries has been reached).
  const factCheckedContent = await chat.request(
    buildFactCheckedPrompt(
      'Write a script for a tiktok video that talks about the artistic contribution of the renaissance.',
    ),
  );

  console.info(
    `The fact checked renaissance content is: ${factCheckedContent.content}`,
  );

  chat.reset();

  const article = await chat.request(
    prompt.text('Write a blog post about the financial crisis of 2008'),
  );

  const entities = await chat.request(
    prompt.json({
      message:
        'What are the different entities in the above blog post? Respond as a JSON array, where the items in the array are just the names of the entities.',
      schema: z.array(z.string()),
    }),
  );

  const titles = await chat.request(
    prompt.bulletPoints({
      message: 'Write a good title for this post, please list out 10 options.',
    }),
  );

  console.info('Chat flow example:', article, entities, titles);

  const model2 = new OpenAI(
    { apiKey: process.env.OPENAI_KEY ?? 'YOUR_OPENAI_KEY' },
    { temperature: 0.2 },
    { retainMemory: true },
  );

  console.info('New model with custom defaults', model2);
}

const models = [
  'gpt-3.5-turbo-0301',
  'gpt-3.5-turbo-0613',
  'gpt-3.5-turbo-16k-0613',
  'gpt-4-0314',
  'gpt-4-0613',
];

(async function go() {
  const results = [];

  for (let itr = 0; itr < 1; itr++) {
    for (const model of models) {
      const streamStart = Date.now();
      await benchmark({ stream: false, model });
      const streamTime = Date.now() - streamStart;

      results.push({
        model,
        iteration: itr,
        time: streamTime,
      });
    }
  }

  console.info(`--- BENCHMARK RESULTS ---`);
  for (const result of results) {
    console.info(
      `model: ${result.model} (${result.iteration + 1}) : ${
        result.time / 1000
      } seconds`,
    );
  }
  console.info('--- END BENCHMARK ---');
})();
