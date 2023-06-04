import EventEmitter from 'events';
import { ConfigurationParameters } from 'openai';
import { z } from 'zod';

import { MaybePromise } from './utils';

export type OpenAIConfigurationParameters = ConfigurationParameters & {
  azureEndpoint?: string;
  azureDeployment?: string;
};

export interface ModelConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string | string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  logitBias?: Record<string, number>;
  user?: string;
  stream?: boolean;
}

export interface ChatConfig {
  // if chat memory should be retained after every request. when enabled, the chat's behavior will be similar to a normal user chat room, and model can have access to history when making inferences. defaults to false
  retainMemory?: boolean;

  // set default request options. note that this can be overridden on a per-request basis
  options?: ChatRequestOptions;
}

export interface Persona {
  prompt: string | (() => string);
  qualifiers?: string[];
  config?: Partial<ModelConfig>;
}

export type ChatRequestOptions = {
  // the number of time to retry this request due to rate limit or recoverable API errors
  retries?: number;
  retryInterval?: number;
  timeout?: number;

  // the minimum amount of tokens to allocate for the response. if the request is predicted to not have enough tokens, it will automatically throw a 'TokenError' without sending the request
  minimumResponseTokens?: number;

  // override the messages used for completion, only use this if you understand the API well
  messages?: Message[];

  // pass in an event emitter to receive message stream events
  events?: EventEmitter;
};

export interface ChatResponse<T = string> {
  content: T;
  model: string;

  // set to true if this content was streamed. note to actually access the stream, you have to pass in an event emitter via ChatRequestOptions
  isStream: boolean;

  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Prompt types

export interface JSONPrompt<T extends z.ZodType> {
  message: string;
  schema: T;
  parseResponse?: (res: string) => MaybePromise<z.infer<T>>;
  retryMessage?: string;
  promptRetries?: number;
}

export interface BulletPointsPrompt {
  message: string;
  amount?: number;
  length?: number;
  promptRetries?: number;
}

export interface BooleanPrompt {
  message: string;
  promptRetries?: number;
}

export interface RawPrompt<T = string> {
  message: string;
  parse?: (
    response: ChatResponse<string>,
  ) => MaybePromise<{ success: false; retryPrompt?: string } | { success: true; data: T }>;
  promptRetries?: number;
}
