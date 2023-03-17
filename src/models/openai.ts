import { isAxiosError } from 'axios';
import { defaults } from 'lodash';
import { Configuration, OpenAIApi } from 'openai';

import { Chat } from 'chat';
import {
  CompletionDefaultRetries,
  CompletionDefaultTimeout,
  RateLimitRetryIntervalMs,
} from 'config';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  ModelConfig,
  OpenAIConfig,
  Persona,
} from 'types';
import { debug, sleep } from 'utils';

import type { Model } from './interface';

export class OpenAI implements Model {
  private openai: OpenAIApi;
  private defaults: ModelConfig;

  constructor(config: OpenAIConfig, defaults: ModelConfig) {
    const configuration = new Configuration({ apiKey: config.apiKey });
    this.openai = new OpenAIApi(configuration);
    this.defaults = defaults;
  }

  chat(persona: Persona, config?: ChatConfig) {
    return new Chat(persona, config ?? {}, this);
  }

  async request(
    messages: Message[],
    config = {} as Partial<ModelConfig>,
    {
      retries = CompletionDefaultRetries,
      retryInterval = RateLimitRetryIntervalMs,
      timeout = CompletionDefaultTimeout,
      ...opt
    }: ChatRequestOptions,
  ): Promise<ChatResponse<string>> {
    try {
      const completion = await this.openai.createChatCompletion(
        {
          messages,
          ...defaults(
            {
              model: config.model,
              temperature: config.temperature,
              top_p: config.topP,
              n: 1,
              stop: config.stop,
              presence_penalty: config.presencePenalty,
              frequency_penalty: config.frequencyPenalty,
              logit_bias: config.logitBias,
              user: config.user,
            },
            this.defaults,
          ),
        },
        {
          timeout,
        },
      );

      const content = completion.data.choices[0].message?.content;
      const usage = completion.data.usage;
      if (!content || !usage) {
        throw new Error('Completion response malformed');
      }

      return {
        content,
        model: completion.data.model,
        usage: {
          totalTokens: usage.total_tokens,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        },
      };
    } catch (error: unknown) {
      if (!isAxiosError(error)) {
        throw error;
      }

      // no more retries left
      if (!retries) {
        debug.log('Completion failed, already retryed, failing completion');
        throw error;
      }

      if (
        error.code === 'ETIMEDOUT' ||
        (error.response && (error.response.status === 429 || error.response.status >= 500))
      ) {
        debug.log('Completion rate limited, retrying...');
        await sleep(retryInterval);
        return this.request(messages, config, {
          ...opt,
          retries: retries - 1,
          // double the interval everytime we retry
          retryInterval: retryInterval * 2,
        });
      }

      throw error;
    }
  }
}
