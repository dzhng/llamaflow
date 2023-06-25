import {
  ChatConfig,
  ChatFunctionResponse,
  ChatRequestOptions,
  ChatResponse,
  Message,
  ModelConfig,
} from '../types';

export interface Model {
  modelConfig: ModelConfig;
  chatConfig: Partial<ChatConfig>;

  request<T>(
    messages: Message[],
    opt?: ChatRequestOptions,
  ): Promise<ChatResponse<string> | ChatFunctionResponse<T>>;

  getTokensFromMessages(messages: Message[]): number;
}
