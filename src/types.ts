import { z } from 'zod';

export interface OpenAIConfig {
  apiKey: string;
}

export interface ModelConfig {
  model: string;
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
  prompt: string;
  qualifiers?: string[];
  config?: Partial<ChatConfig> & Partial<ModelConfig>;
}

export type ChatRequestOptions = {
  // the number of time to retry this request due to rate limit or retriable API errors
  retries?: number;
  retryInterval?: number;
  timeout?: number;
};

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Prompt types

export interface PromptOptions {
  // number of times to retry the validation by asking the LLM again
  retries?: number;
}

export interface JSONPrompt<T = any> {
  initialMessage: string;
  formatMessage?: string;
  parseResponse?: (res: string) => T;
  schema: z.ZodType<T>;
}

export interface BulletPointsPrompt {
  message: string;
  amount?: number;
  length?: number;
}

export interface RawPrompt<T = any> {
  message: string;
  validate?: (
    response: ChatResponse,
  ) => Promise<{ success: false; retryPrompt?: string } | { success: true; data: T }>;
}

export type Prompt = string | RawPrompt | JSONPrompt;
