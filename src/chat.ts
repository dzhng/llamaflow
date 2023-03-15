import { Model } from '~/models/interface';

import { buildMessage } from './persona';
import { coerceToRawPrompt } from './prompts';
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

  constructor(persona: Persona, config: ChatConfig, model: Model) {
    this.persona = persona;
    this.config = config;
    this.model = model;

    // build system message
    this.messages = [
      {
        role: 'system',
        content: buildMessage(this.persona),
      },
    ];
  }

  async request<T>(prompt: Prompt<T>, opt?: ChatRequestOptions): Promise<ChatResponse<T>> {
    const coercedPrompt = coerceToRawPrompt(prompt);
    const newMessages: Message[] = [
      ...(opt?.messages ? opt.messages : this.messages),
      {
        role: 'user',
        content: coercedPrompt.message,
      },
    ];
    const response = await this.model.request(newMessages, this.persona.config, opt);
    if (!response) {
      throw new Error('Chat request failed');
    }

    const messagesWithResponse: Message[] = [
      ...newMessages,
      {
        role: 'assistant',
        content: response.content,
      },
    ];

    // validate res content, and recursively loop if invalid
    if (coercedPrompt.parse) {
      const res = await coercedPrompt.parse(response);
      if (res.success) {
        if (this.config.retainMemory) {
          this.messages = messagesWithResponse;
        }

        return {
          ...response,
          content: res.data,
        };
      } else {
        // iterate recursively until retries are up
        if (opt?.retries && opt.retries > 0 && res.retryPrompt) {
          return this.request(
            {
              ...coercedPrompt,
              message: res.retryPrompt,
            },
            {
              messages: messagesWithResponse,
              retries: opt.retries - 1,
            },
          );
        } else {
          throw new Error('Response parsing failed');
        }
      }
    }

    if (this.config.retainMemory) {
      this.messages = messagesWithResponse;
    }

    return response as ChatResponse<string>;
  }
}
