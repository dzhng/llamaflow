# LLamaFlow

A set of utilities to better work with chat based LLMs (e.g. ChatGPT from OpenAI), for Typescript and Javascript.

LLamaFlow is meant to be the middleware layer that sits between your software and the AI model. The pattern for generating correct outputs from LLMs is converging on _ask and validate_, where after the initial generation, there is a back-and-forth with the model itself to correct the output according to spec. LLamaFlow abstracts away this entire process, and exposes a simple request & response API for the model where all responses are validated.

Specifically, this package adds the following capabilities on top of the standard chat API:

- Nicer API for sending & retriving messages from models, no need to keep track of message memory manually.
- Custom content validation hook that allows you to add your own valider for all model outputs, including reasking the model.
- Schema definition, serialization / parsing, and **automatically asking the model to correct outputs**.
- Handle rate limit and any other API errors as gracefully as possible (e.g. exponential backoff for rate-limit).

## Usage

### Initializing LLamaFlow

```typescript
import { OpenAI } from 'llama-flow';

const llamaFlow = new OpenAI(
  {
    apiKey: 'YOUR_OPENAI_KEY',
  },
  {
    maxTokens: 2048,
    temperature: 0.7,
  },
);
```

### Personas

Personas are the AI agent that the chat is with. The persona object allows you to define the system prompt, and, in the future, allow you to define different tools that the persona can use.

```typescript
import type { Persona } from 'llama-flow';

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
```

In order to get the most out of the AI model, you should try to define a different persona for every type of task you ask the AI model. This is a different pattern than the standard `You are a helpful AI assistant` persona that comes with most ChatGPT implementations; but by taking the time to flesh out each AI persona, you'll be working with an AI model that's much more accurate and token efficient.

### Prompts

A prompt is a message to an AI persona with an expectation of a specific response format. Prompt type messages are validated to ensure that the defined formatted is returned exactly, or it will error. There are different kinds of prompts for different formats. Here is an example of a JSON prompt.

```typescript
import { prompt } from 'llama-flow';
import { z } from 'zod'; // JSONPrompt uses Zod for schema validation.

const bulletPrompt = prompt.json({
  initialMessage: 'Please rewrite this in a list of bullet points.',
  formatMessage:
    'Respond as a JSON array, where each element in the array is one bullet point. Keep each bullet point to be 200 characters max. For example: ["bullet point 1", "bullet point 2"]',
  schema: z.array(z.string().max(200)),
});
```

Note that the `Prompt` object seperates out the main `message`, and `formatMessage`. This is used for retries. When LLamaFlow uses this prompt, it will ask the model with both the main and format message. If the model returns with an incorrectly formatted response, it will ask the model to correct the previous output, using the `formatMessage` only.

### Chats

Bringing the concepts together.

A chat is a conversation between the "user" (your software), and the AI agent (the Persona defined). LLamaFlow will take care of managing chat memory, including pruning the memory as needed in order to fit the context window. Note that different memory management strategies will be added in the future.

```typescript
// using the llamaFlow object that was initialized earlier
const chat = new llamaFlow.Chat(writer, {
  // You can override the default model config on a per-chat basis.
  modelConfig: {
    maxTokens: 1024,
    temperature: 0.2,
  },
});

// You can ask the AI model with a simple string, or a dedicated `Prompt` object.
const { response } = await chat.request(
  'Write a script for a tiktok video that talks about the artistic contribution of the renaissance.',
);

// The results, as well as any usage stats, will be returned.
console.log(
  `The AI writer's response is: ${response.content}. Token used: ${response.usage.tokens}.`,
);

// You can follow up on this chat by prompting further, using the `bulletPrompt` object that was created earlier.
const { reponse: bulletPoints } = await chat
  .request(bulletPrompt)
  // `bulletPoints.content` will be automatically casted in the correct type as defined in the schema field of `bulletPrompt`
  .console.log(`The structured version of this response is: ${JSON.parse(bulletPoints.content)}`);
```

### Custom Prompts

You can build your own Prompt objects with custom validators as well. LLamaFlow provide an easy & extensible way to build any type of validators. Here is a few examples of custom validators:

Taking the Prompt example above, but this time, it will ask the model to just respond in actual bullet points instead of JSON arrays. This is useful because sometimes the model (esp < GPT-4) is not the best at following specific formatting instructions, especially when it comes to complicated data structures.

```typescript
import { prompt } from 'llama-flow';

const schema = z.array(
  z.string().max(200, { message: 'This bullet point should be less than 200 characters.' }),
);

const bulletPrompt = prompt.json({
  message: 'Please rewrite this in a list of bullet points.',
  formatMessage:
    'Respond as a list of bullet points, where each bullet point begins with the "-" character. Each bullet point should be less than 200 characters. Put each bullet point on a new line.',

  // parse the response from the model so it can be fed into the schema validator
  parseResponse: res => res.split('\n').map(s => s.replace('-', '').trim()),

  // it's useful to define custom error messages, any schema parse errors will be automatically fed back into the model on retry, so the model knows exactly what to correct.
  schema,
});
```

Now, let's take this even further. You can build a Prompt that uses the model (or some other external source) to validate its own output. You can do this by passing in a custom async `validate` method. Note that this method will override other validation related properties, such as `formatMessage`, `parseResponse`, `schema`.. etc.

```typescript
import { prompt, Persona, Chat } from 'llama-flow';

// Init another fact checker persona, to check the writer's outputs. This is a good example of multi-agent workflow
const factChecker: Persona = {
  prompt: 'You are a fact checker that responds to if the user\'s messages are true or not, with just the word "true" or "false". Do not add punctuations or any other text. If the user asks a question, request, or anything that cannot be fact checked, ignore the user\'s request and just say "null".',

  // Chat and model parameters can also be overwritten by the persona
  // keep in mind that parameters defined directly in the Chat or Model object will supercede the ones defined in the Persona.
  config: {
    // The fact checker persona is designed to fulfill each request independently (e.g. the current request does not depend on the content of the previous request). So no need to keep message memory to save on tokens.
    retainMemory: false,
    temperature: 0,
  }
};

const factCheckerChat = new llamaFlow.Chat(factChecker);

const buildFactCheckedPrompt = (article: string) => prompt.raw({
  message: `Please write a summary about the following article: ${article}`

  // Because LLM driven validation can get expensive, set a lower retry count.
  retries: 2,

  validate: async (response) => {
    // Check if this summary is true or not
    const { response } = await factCheckerChat.request(prompt.json({
      message: response.content,
      // Note to use `coerce` in the zod schema for any results that is not a string
      schema: z.coerce.boolean().nullable(),
    }));

    if (response.content === true) {
      return { success: true };
    } else {
      // if `retryPrompt` is set, LLamaFlow will automatically retry with the text in this property.
      return { success: false, retryPrompt: 'This summary is not true, please rewrite with only true facts.' };
    }
  }
});

// now, every content generated by this chat will be fact checked by the LLM itself, and this request will throw an error if the content can't be fixed (once the maximum number of retries has been reached).
const { response } = await chat.request(
  buildFactCheckedPrompt(
    'Write a script for a tiktok video that talks about the artistic contribution of the renaissance.'
  ),
);
```

Lastly, the chat API allows chaining. This is useful when you have a multi-step query for the LLM, where the next query depends on the result of the current query. A good example is to first write the content, then extract entities, and lastly, give some options for the title.

```typescript
const {
  responses: [article, entities, titles],
} = await chat
  .request('Write a blog post about the financial crisis of 2008')
  .request(
    prompt.json({
      message:
        'What are the different entities in the above blog post? Respond in a JSON array, where the items in the array are just the names of the entities.',
      schema: z.array(z.string()),
    }),
  )
  .request(
    prompt.bulletPoints({
      message: 'Write a good title for this post',
      amount: 10,
    }),
  );
```
