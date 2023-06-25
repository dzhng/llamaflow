import {
  ChatConfig,
  ChatRequestOptions,
  ChatResponse,
  Message,
  ModelConfig,
} from '../types';

export interface Model {
  modelConfig: ModelConfig;
  chatConfig: ChatConfig;

  request(
    messages: Message[],
    opt?: ChatRequestOptions,
  ): Promise<ChatResponse<string>>;

  getTokensFromMessages(messages: Message[]): number;
}
