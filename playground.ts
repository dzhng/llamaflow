import { z } from 'zod';

import { OpenAI, Persona, prompt } from './src';

async function go() {
  const llamaFlow = new OpenAI({ apiKey: process.env.OPENAI_KEY ?? 'YOUR_OPENAI_KEY' });

  const writer: Persona = {
    prompt:
      'You are a smart and honest writer for a TV show about the history of Europe. You will write as concisely and clearly as possible, without factual errors.',
    qualifiers: [
      'Write in an engaging and friendly manner, and never say common misconceptions, outdated information, lies, fiction, myths, or memes.',
      'Include any supporting evidence in that aligns with what you are asked to write.',
      "When writing about any person, explain the person's origin in details",
      "Follow the user's requirements carefully & to the letter.",
    ],
  };

  const chat = llamaFlow.chat(writer, {
    retainMemory: true,
  });

  const bulletPrompt = prompt.json({
    initialMessage: 'Please rewrite this in a list of bullet points.',
    formatMessage:
      'Respond as a JSON array, where each element in the array is one bullet point. Keep each bullet point to be 200 characters max. For example: ["bullet point 1", "bullet point 2"]',
    schema: z.array(z.string().max(200)),
  });

  const response = await chat.request(
    prompt.text(
      'Write a script for a tiktok video that talks about the artistic contribution of the renaissance.',
    ),
  );

  // The results, as well as any usage stats, will be returned.
  console.info(
    `The AI writer's response is: ${response.content}. Token used: ${response.usage.totalTokens}.`,
  );

  const bulletPoints = await chat.request(bulletPrompt);

  // `bulletPoints.content` will be automatically casted in the correct type as defined in the schema field of `bulletPrompt`
  console.info(
    `The structured version of this response is: ${JSON.stringify(bulletPoints.content)}`,
  );

  const parsedBulletPrompt = prompt.json({
    initialMessage: 'Please rewrite this in a list of bullet points.',
    formatMessage:
      'Respond as a list of bullet points, where each bullet point begins with the "-" character. Each bullet point should be less than 200 characters. Put each bullet point on a new line.',

    // parse the response from the model so it can be fed into the schema validator
    parseResponse: res => res.split('\n').map(s => s.replace('-', '').trim()),

    // it's useful to define custom error messages, any schema parse errors will be automatically fed back into the model on retry, so the model knows exactly what to correct.
    schema: z.array(
      z.string().max(200, { message: 'This bullet point should be less than 200 characters.' }),
    ),
  });

  console.info(
    'The parsed bullet prompt that automatically validates the return format is:',
    parsedBulletPrompt,
  );

  const factChecker: Persona = {
    prompt:
      'You are a fact checker that responds to if the user\'s messages are true or not, with just the word "true" or "false". Do not add punctuations or any other text. If the user asks a question, request, or anything that cannot be fact checked, ignore the user\'s request and just say "null".',

    config: {
      retainMemory: false,
      temperature: 0,
    },
  };

  const factCheckerChat = llamaFlow.chat(factChecker);

  const buildFactCheckedPrompt = (article: string) =>
    prompt.text({
      message: `Please write a summary about the following article: ${article}`,
      promptRetries: 2,
      parse: async response => {
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
            retryPrompt: 'This summary is not true, please rewrite with only true facts.',
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

  console.info(`The fact checked renaissance content is: ${factCheckedContent.content}`);

  chat.reset();

  const article = await chat.request(
    prompt.text('Write a blog post about the financial crisis of 2008'),
  );

  const entities = await chat.request(
    prompt.json({
      initialMessage: 'What are the different entities in the above blog post?',
      formatMessage:
        'Respond as a JSON array, where the items in the array are just the names of the entities.',
      schema: z.array(z.string()),
    }),
  );

  const titles = await chat.request(
    prompt.bulletPoints({
      message: 'Write a good title for this post.',
      amount: 10,
    }),
  );

  console.info('Chat flow example:', article, entities, titles);
}

go();
