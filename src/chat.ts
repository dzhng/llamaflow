import { defaults } from 'lodash';

import { PromptDefaultRetries } from './config';
import { TokenError } from './models/errors';
import { Model } from './models/interface';
import { RecursiveCharacterTextSplitter } from './text-splitter';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  RawPrompt,
} from './types';
import { debug } from './utils';

const DefaultChunkSize = 50_000;
const DefaultMinChunkSize = 1000;

export type SplitRequestFn<T> = (
  text: string,
  chunkSize: number,
) => RawPrompt<T>;

export class Chat {
  config: ChatConfig;
  model: Model;
  messages: Message[];

  constructor(config: ChatConfig, model: Model) {
    this.config = config;
    this.model = model;
    this.messages = [];

    this.reset();
  }

  async request<T>(
    prompt: RawPrompt<T>,
    opt?: ChatRequestOptions,
  ): Promise<ChatResponse<T>> {
    debug.log('⬆️ sending request:', prompt.message);
    const newMessages: Message[] = [
      ...(opt?.messages ? opt.messages : this.messages),
      {
        role: 'user',
        content: prompt.message,
      },
    ];

    const mergedOpt = defaults(opt, this.config.options);
    const response = await this.model.request(newMessages, mergedOpt);
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

  // make a requset, and split the text via chunk size if request is unsuccessful. continues until the request is split into the right chunk size
  async requestWithSplit<T>(
    originalText: string,
    requestFn: SplitRequestFn<T>,
    opt?: ChatRequestOptions,
    chunkSize = DefaultChunkSize,
    minumChunkSize = DefaultMinChunkSize,
  ): Promise<ChatResponse<T>> {
    if (chunkSize < minumChunkSize) {
      throw new Error(
        'Text chunk size is below the minumim required chunk size, cannot split anymore',
      );
    }

    try {
      const res = await this.request(requestFn(originalText, chunkSize), opt);
      return res;
    } catch (e) {
      if (e instanceof TokenError) {
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize,
          chunkOverlap: Math.floor(Math.min(chunkSize / 4, 200)),
        });

        debug.log(
          `⚠️ Request prompt too long, splitting text with chunk size of ${chunkSize}`,
        );
        return this.requestWithSplit(
          textSplitter.splitText(originalText)[0],
          requestFn,
          opt,
          Math.floor(chunkSize / 2),
          minumChunkSize,
        );
      } else {
        throw e;
      }
    }
  }

  reset() {
    // build system message
    this.messages = [
      {
        role: 'system',
        content: this.config.systemMessage,
      },
    ];
  }
}
