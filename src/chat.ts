import { Model } from 'models/interface';

import { PromptDefaultRetries } from './config';
import { buildMessage } from './persona';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  Persona,
  RawPrompt,
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

  async request<T>(prompt: RawPrompt<T>, opt?: ChatRequestOptions): Promise<ChatResponse<T>> {
    const newMessages: Message[] = [
      ...(opt?.messages ? opt.messages : this.messages),
      {
        role: 'user',
        content: prompt.message,
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
    if (prompt.parse) {
      const res = await prompt.parse(response);
      if (res.success) {
        if (this.config.retainMemory) {
          this.messages = messagesWithResponse;
        }

        return {
          ...response,
          content: res.data,
        };
      } else {
        // iterate recursively until promptRetries are up
        const promptRetries = prompt.promptRetries ?? PromptDefaultRetries;
        if (promptRetries > 0 && res.retryPrompt) {
          return this.request(
            {
              ...prompt,
              message: res.retryPrompt,
              promptRetries: promptRetries - 1,
            },
            {
              messages: messagesWithResponse,
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

    // NOTE: there's an error here:
    // Type 'ChatResponse<string>' is not assignable to type 'ChatResponse<T>'
    // Will cast to any for now
    return response as any;
  }
}
