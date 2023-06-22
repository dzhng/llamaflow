import tiktoken from 'js-tiktoken';
import jsonic from 'jsonic';
import { defaults } from 'lodash';
import {
  Configuration,
  CreateChatCompletionRequest,
  OpenAIApi,
} from 'openai-edge';
import { Readable } from 'stream';

import { Chat } from '../chat';
import {
  CompletionDefaultRetries,
  CompletionDefaultTimeout,
  MinimumResponseTokens,
  RateLimitRetryIntervalMs,
} from '../config';
import type {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  ModelConfig,
  OpenAIConfigurationParameters,
  Persona,
} from '../types';
import { debug, sleep } from '../utils';

import { TokenError } from './errors';
import type { Model } from './interface';

interface CreateChatCompletionResponse extends Readable {}

const Defaults: CreateChatCompletionRequest = {
  model: 'gpt-3.5-turbo',
  messages: [],
};
const RequestDefaults = {
  retries: CompletionDefaultRetries,
  retryInterval: RateLimitRetryIntervalMs,
  timeout: CompletionDefaultTimeout,
  minimumResponseTokens: MinimumResponseTokens,
};
const AzureQueryParams = { 'api-version': '2023-03-15-preview' };

const getTokenLimit = (model: string) => (model === 'gpt-4' ? 8000 : 4096);
const encoder = tiktoken.getEncoding('cl100k_base');

const convertConfig = (
  config: Partial<ModelConfig>,
): Partial<CreateChatCompletionRequest> => ({
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
  _model: OpenAIApi;
  _isAzure: boolean;
  _headers?: Record<string, string>;
  defaults: ModelConfig;
  config: ChatConfig;

  constructor(
    config: OpenAIConfigurationParameters,
    defaults?: ModelConfig,
    chatConfig?: ChatConfig,
  ) {
    this._isAzure = Boolean(config.azureEndpoint && config.azureDeployment);
    const configuration = new Configuration({
      ...config,
      basePath: this._isAzure
        ? `${config.azureEndpoint}${
            config.azureEndpoint?.at(-1) === '/' ? '' : '/'
          }openai/deployments/${config.azureDeployment}?${new URLSearchParams(
            AzureQueryParams,
          )}`
        : undefined,
    });
    this._headers = this._isAzure
      ? { 'api-key': String(config.apiKey) }
      : undefined;
    this._model = new OpenAIApi(configuration);

    this.defaults = defaults ?? {};
    this.config = chatConfig ?? {};
  }

  chat(persona: Persona, config?: ChatConfig) {
    const finalConfig = defaults(config, this.config);
    return new Chat(persona, finalConfig ?? {}, this);
  }

  getTokensFromMessages(messages: Message[]) {
    let numTokens = 0;
    for (const message of messages) {
      numTokens += 5; // every message follows <im_start>{role/name}\n{content}<im_end>\n
      numTokens += encoder.encode(message.content).length;
    }
    numTokens += 2; // every reply is primed with <im_start>assistant\n
    return numTokens;
  }

  async request(
    messages: Message[],
    config = {} as Partial<ModelConfig>,
    requestOptions = {} as Partial<ChatRequestOptions>,
  ): Promise<ChatResponse<string>> {
    const finalConfig = defaults(
      convertConfig(config),
      convertConfig(this.defaults),
      Defaults,
    );
    const finalRequestOptions = defaults(
      requestOptions,
      this.config.options,
      RequestDefaults,
    );
    debug.log(
      `Sending request with config: ${JSON.stringify(
        finalConfig,
      )}, options: ${JSON.stringify(finalRequestOptions)}`,
    );
    try {
      // check if we'll have enough tokens to meet the minimum response
      const maxPromptTokens =
        getTokenLimit(finalConfig.model) -
        finalRequestOptions.minimumResponseTokens;
      const messageTokens = this.getTokensFromMessages(messages);
      if (messageTokens > maxPromptTokens) {
        throw new TokenError(
          'Prompt too big, not enough tokens to meet minimum response',
          messageTokens - maxPromptTokens,
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        finalRequestOptions.timeout,
      );
      const completion = await this._model.createChatCompletion(
        {
          ...finalConfig,
          messages,
          stream: finalConfig.stream,
        },
        {
          signal: controller.signal,
          headers: this._headers,
        },
      );
      clearTimeout(timeoutId);

      if (!completion.ok) {
        if (completion.status === 401) {
          debug.error(
            'Authorization error, did you set the OpenAI API key correctly?',
          );
          throw new Error('Authorization error');
        } else if (completion.status === 429 || completion.status >= 500) {
          debug.log(
            `Completion rate limited (${completion.status}), retrying... attempts left: ${finalRequestOptions.retries}`,
          );
          await sleep(finalRequestOptions.retryInterval);
          return this.request(messages, config, {
            ...finalRequestOptions,
            retries: finalRequestOptions.retries - 1,
            // double the interval everytime we retry
            retryInterval: finalRequestOptions.retryInterval * 2,
          });
        }
      }

      let content: string | undefined;
      if (finalConfig.stream) {
        // @ts-ignore
        const response = completion.body as CreateChatCompletionResponse;

        debug.write('[STREAM] response received:\n');
        content = await new Promise<string>((resolve, reject) => {
          let res = '';
          response.on('data', (message: Buffer) => {
            const stringfied = message.toString('utf8').split('\n');

            for (const line of stringfied) {
              try {
                const cleaned = line.replace('data:', '').trim();
                if (cleaned.length === 0 || cleaned === '[DONE]') {
                  continue;
                }

                const parsed = jsonic(cleaned);
                const text = parsed.choices[0].delta.content ?? '';

                debug.write(text);
                finalRequestOptions?.events?.emit('data', text);
                res += text;
              } catch (e) {
                debug.error(
                  'Error parsing content:',
                  message.toString('utf8'),
                  e,
                );
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
        content = (await completion.json()).choices[0].message?.content;
      }

      if (!content) {
        throw new Error('Completion response malformed');
      }

      const usage = !finalConfig.stream && (await completion.json()).usage;
      return {
        content,
        isStream: Boolean(finalConfig.stream),
        usage: usage
          ? {
              totalTokens: usage.total_tokens,
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      // no more retries left
      if (!finalRequestOptions.retries) {
        debug.log('Completion failed, already retryed, failing completion');
        throw error;
      }

      if (
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ECONNRESET'
      ) {
        debug.log(
          `Completion timed out (${error.code}), retrying... attempts left: ${finalRequestOptions.retries}`,
        );
        await sleep(finalRequestOptions.retryInterval);
        return this.request(messages, config, {
          ...finalRequestOptions,
          retries: finalRequestOptions.retries - 1,
          // double the interval everytime we retry
          retryInterval: finalRequestOptions.retryInterval * 2,
        });
      }

      throw error;
    }
  }
}
