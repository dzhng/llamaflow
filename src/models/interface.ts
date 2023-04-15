import { ChatConfig, ChatRequestOptions, ChatResponse, Message, ModelConfig } from '../types';

export interface Model {
  defaults: ModelConfig;
  config: ChatConfig;

  request(
    messages: Message[],
    config?: Partial<ModelConfig>,
    opt?: ChatRequestOptions,
  ): Promise<ChatResponse<string>>;

  getTokensFromMessages(messages: Message[]): number;
}
