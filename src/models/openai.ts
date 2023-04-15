import { isAxiosError } from 'axios';
import jsonic from 'jsonic';
import { defaults } from 'lodash';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { Readable } from 'stream';

import { Chat } from '../chat';
import {
  CompletionDefaultRetries,
  CompletionDefaultTimeout,
  RateLimitRetryIntervalMs,
} from '../config';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  ModelConfig,
  OpenAIConfig,
  Persona,
} from '../types';
import { debug, sleep } from '../utils';

import type { Model } from './interface';

interface CreateChatCompletionResponse extends Readable {}

const Defaults: CreateChatCompletionRequest = { model: 'gpt-3.5-turbo', messages: [] };

const convertConfig = (config: Partial<ModelConfig>): Partial<CreateChatCompletionRequest> => ({
  model: config.model,
  temperature: config.temperature,
  top_p: config.topP,
  n: 1,
  stop: config.stop,
  presence_penalty: config.presencePenalty,
  frequency_penalty: config.frequencyPenalty,
  logit_bias: config.logitBias,
  user: config.user,
  stream: config.stream,
});

export class OpenAI implements Model {
  public _model: OpenAIApi;
  private defaults: ModelConfig;
  private config: ChatConfig;

  constructor(config: OpenAIConfig, defaults?: ModelConfig, chatConfig?: ChatConfig) {
    const configuration = new Configuration({ apiKey: config.apiKey });
    this._model = new OpenAIApi(configuration);
    this.defaults = defaults ?? {};
    this.config = chatConfig ?? {};
  }

  chat(persona: Persona, config?: ChatConfig) {
    const finalConfig = defaults(config, this.config);
    return new Chat(persona, finalConfig ?? {}, this);
  }

  async request(
    messages: Message[],
    config = {} as Partial<ModelConfig>,
    {
      retries = CompletionDefaultRetries,
      retryInterval = RateLimitRetryIntervalMs,
      timeout = CompletionDefaultTimeout,
      events,
    } = {} as ChatRequestOptions,
  ): Promise<ChatResponse<string>> {
    const finalConfig = defaults(convertConfig(config), convertConfig(this.defaults), Defaults);
    debug.log(`Sending request with ${retries} retries, config: ${JSON.stringify(finalConfig)}`);
    try {
      const completion = await this._model.createChatCompletion(
        {
          ...finalConfig,
          messages,
          stream: finalConfig.stream,
        },
        { timeout, responseType: finalConfig.stream ? 'stream' : 'json' },
      );

      // @ts-ignore
      const response: CreateChatCompletionResponse = completion.data;

      let content: string | undefined;
      if (finalConfig.stream) {
        debug.write('[STREAM] response received:\n');
        content = await new Promise<string>((resolve, reject) => {
          let res = '';
          response.on('data', (message: Buffer) => {
            const stringfied = message.toString('ascii').split('\n');
            for (const line of stringfied) {
              try {
                const cleaned = line.replace('data:', '').trim();
                if (cleaned.length === 0 || cleaned === '[DONE]') {
                  continue;
                }

                const parsed = jsonic(cleaned);
                const text = parsed.choices[0].delta.content ?? '';

                debug.write(text);
                events?.emit('data', text);
                res += text;
              } catch (e) {
                debug.error('Error parsing content:', message.toString('ascii'), e);
              }
            }
          });
          response.on('close', () => {
            resolve(res);
          });
          response.on('error', () => reject(new Error('Error reading stream')));
        });
        debug.write('\n[STREAM] response end\n');
      } else {
        content = completion.data.choices[0].message?.content;
      }

      const usage = completion.data.usage;
      if (!content) {
        throw new Error('Completion response malformed');
      }

      return {
        content,
        model: completion.data.model,
        usage: usage
          ? {
              totalTokens: usage.total_tokens,
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            }
          : undefined,
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
        error.code === 'ECONNABORTED' ||
        error.code === 'ECONNRESET' ||
        (error.response && (error.response.status === 429 || error.response.status >= 500))
      ) {
        debug.log(`Completion rate limited, retrying... attempts left: ${retries}`);
        await sleep(retryInterval);
        return this.request(messages, config, {
          retries: retries - 1,
          // double the interval everytime we retry
          retryInterval: retryInterval * 2,
          timeout,
          events,
        });
      }

      if (error?.response?.status === 401) {
        debug.error('Authorization error, did you set the OpenAI API key correctly?');
      }

      throw error;
    }
  }
}
