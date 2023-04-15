import { defaults } from 'lodash';

import { PromptDefaultRetries } from './config';
import { Model } from './models/interface';
import { buildMessage } from './persona';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  Persona,
  RawPrompt,
} from './types';
import { debug } from './utils';

export class Chat {
  persona: Persona;
  config: ChatConfig;
  model: Model;
  messages: Message[];

  constructor(persona: Persona, config: ChatConfig, model: Model) {
    this.persona = persona;
    this.config = config;
    this.model = model;
    this.messages = [];

    this.reset();
  }

  async request<T>(prompt: RawPrompt<T>, opt?: ChatRequestOptions): Promise<ChatResponse<T>> {
    debug.log('⬆️ sending request:', prompt.message);
    const newMessages: Message[] = [
      ...(opt?.messages ? opt.messages : this.messages),
      {
        role: 'user',
        content: prompt.message,
      },
    ];

    const mergedOpt = defaults(opt, this.config.options);
    const response = await this.model.request(newMessages, this.persona.config, mergedOpt);
    if (!response) {
      throw new Error('Chat request failed');
    }

    // only send this debug msg when stream is not enabled, or there'll be duplicate log msgs since stream also streams in the logs
    !response.isStream && debug.log('⬇️ received response:', response.content);

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
          debug.log(
            `⚠️ retrying request with prompt: ${res.retryPrompt}\nCurrent message stack:`,
            messagesWithResponse,
          );
          return this.request(
            {
              ...prompt,
              message: res.retryPrompt,
              promptRetries: promptRetries - 1,
            },
            { ...opt, messages: messagesWithResponse },
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

  reset() {
    // build system message
    this.messages = [
      {
        role: 'system',
        content: buildMessage(this.persona),
      },
    ];
  }
}
