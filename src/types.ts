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

export interface Prompt<T = any> {
  message: string;
  formatMessage?: string;
  parseResponse?: (res: string) => T;
  schema?: z.ZodType<T>;
  retries?: number;
  validate?: (response: Response) => Promise<{ success: boolean; retryPrompt?: string }>;
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
