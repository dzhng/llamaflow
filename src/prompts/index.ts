import { Prompt } from './types';

export function buildInitialMessage(prompt: Prompt) {
  if (!prompt.formatMessage) {
    return prompt.message;
  }

  return `${prompt.message.trim()} ${prompt.formatMessage}`;
}
