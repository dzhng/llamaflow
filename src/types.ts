import { z } from 'zod';

import { MaybePromise } from './utils';

export interface OpenAIConfig {
  apiKey: string;
}

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
}

export interface ChatConfig {
  retainMemory?: boolean;
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

  // override the messages used for completion, only use this if you understand the API well
  messages?: Message[];
};

export interface ChatResponse<T = string> {
  content: T;
  model: string;
  usage: {
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
