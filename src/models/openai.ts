import tiktoken from 'js-tiktoken';
import jsonic from 'jsonic';
import { defaults } from 'lodash';
import {
  Configuration,
  CreateChatCompletionRequest,
  OpenAIApi,
} from 'openai-edge';

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
} from '../types';
import { debug, sleep } from '../utils';

import { TokenError } from './errors';
import type { Model } from './interface';

const RequestDefaults = {
  retries: CompletionDefaultRetries,
  retryInterval: RateLimitRetryIntervalMs,
  timeout: CompletionDefaultTimeout,
  minimumResponseTokens: MinimumResponseTokens,
};
const AzureQueryParams = { 'api-version': '2023-03-15-preview' };

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
  modelConfig: ModelConfig;
  chatConfig: Partial<ChatConfig>;

  constructor(
    config: OpenAIConfigurationParameters,
    modelConfig?: ModelConfig,
    chatConfig?: Partial<ChatConfig>,
  ) {
    this._isAzure = Boolean(config.azureEndpoint && config.azureDeployment);

    const configuration = new Configuration({
      ...config,
      basePath: this._isAzure
        ? `${config.azureEndpoint}${
            config.azureEndpoint?.at(-1) === '/' ? '' : '/'
          }openai/deployments/${config.azureDeployment}`
        : undefined,
    });

    this._headers = this._isAzure
      ? { 'api-key': String(config.apiKey) }
      : undefined;

    const azureFetch: typeof globalThis.fetch = (input, init) => {
      const customInput =
        typeof input === 'string'
          ? `${input}?${new URLSearchParams(AzureQueryParams)}`
          : input instanceof URL
          ? `${input.toString()}?${new URLSearchParams(AzureQueryParams)}`
          : input;
      return fetch(customInput, init);
    };

    this._model = new OpenAIApi(
      configuration,
      undefined,
      this._isAzure ? azureFetch : undefined,
    );

    this.modelConfig = modelConfig ?? {};
    this.chatConfig = chatConfig ?? {
      systemMessage: 'You are a helpful AI assistant',
    };
  }

  chat(config?: ChatConfig) {
    const finalConfig = defaults(config, this.chatConfig);
    return new Chat(finalConfig ?? {}, this);
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

  // eslint-disable-next-line complexity
  async request(
    messages: Message[],
    requestOptions = {} as Partial<ChatRequestOptions>,
  ): Promise<ChatResponse<string>> {
    const finalRequestOptions = defaults(requestOptions, RequestDefaults);
    debug.log(
      `Sending request with config: ${JSON.stringify(
        this.modelConfig,
      )}, options: ${JSON.stringify(finalRequestOptions)}`,
    );
    try {
      // check if we'll have enough tokens to meet the minimum response
      const maxPromptTokens = this.modelConfig.contextSize
        ? this.modelConfig.contextSize -
          finalRequestOptions.minimumResponseTokens
        : 100_000;
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
          model: 'gpt-3.5-turbo',
          ...convertConfig(this.modelConfig),
          messages,
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
          return this.request(messages, {
            ...finalRequestOptions,
            retries: finalRequestOptions.retries - 1,
            // double the interval everytime we retry
            retryInterval: finalRequestOptions.retryInterval * 2,
          });
        }
      }

      let content = '';
      let usage: any;
      if (this.modelConfig.stream) {
        const reader = completion.body?.getReader();
        if (!reader) {
          throw new Error('Reader undefined');
        }

        const decoder = new TextDecoder('utf-8');
        while (true) {
          const { done, value } = await reader.read();
          const stringfied = decoder.decode(value).split('\n');

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
              content += text;
            } catch (e) {
              debug.error('Error parsing content', e);
            }
          }

          if (done) {
            break;
          }
        }
        debug.write('\n[STREAM] response end\n');
      } else {
        const body = await completion.json();
        if (body.error || !('choices' in body)) {
          throw new Error(
            `Completion response error: ${JSON.stringify(body ?? {})}`,
          );
        }

        content = body.choices[0].message?.content;
        usage = body.usage;
      }

      if (!content) {
        throw new Error('Completion response malformed');
      }

      return {
        content,
        isStream: Boolean(this.modelConfig.stream),
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
        return this.request(messages, {
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
