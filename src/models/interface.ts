import { ChatRequestOptions, ChatResponse, Message, ModelConfig } from '~/types';

export interface Model {
  request(
    messages: Message[],
    config?: Partial<ModelConfig>,
    opt?: ChatRequestOptions,
  ): Promise<ChatResponse>;
}
