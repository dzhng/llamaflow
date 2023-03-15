import { Model } from '~/models/interface';

import { buildMessage } from './persona';
import { buildInitialMessage } from './prompts';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  Persona,
  Prompt,
} from './types';

export class Chat {
  persona: Persona;
  config: ChatConfig;
  model: Model;
  messages: Message[];

  // stores the last response in this chat
  response: ChatResponse | undefined;
  allResponses: ChatResponse[];

  constructor(persona: Persona, config: ChatConfig, model: Model) {
    this.persona = persona;
    this.config = config;
    this.model = model;
    this.response = undefined;
    this.allResponses = [];

    // build system message
    this.messages = [
      {
        role: 'system',
        content: buildMessage(this.persona),
      },
    ];
  }

  async request(prompt: Prompt, opt?: ChatRequestOptions): Promise<Chat> {
    const coercedPrompt = typeof prompt === 'string' ? { message: prompt } : prompt;
    const newMessages: Message[] = [
      ...this.messages,
      {
        role: 'user',
        content: buildInitialMessage(coercedPrompt),
      },
    ];

    const res = await this.model.request(newMessages, this.persona.config, opt);

    // validate res content, and recursively loop if invalid

    if (this.config.retainMemory) {
      this.messages = [
        ...newMessages,
        {
          role: 'assistant',
          content: res.content,
        },
      ];
    }

    this.response = res;
    this.allResponses.push(res);
    return this;
  }
}
