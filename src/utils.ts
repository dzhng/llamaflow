import { debug as mDebug } from 'debug';
import type { RawPrompt } from './types';

const error = mDebug('llama-flow:error');
const log = mDebug('llama-flow:log');
log.log = console.log.bind(console);

export const debug = {
  error,
  log,
};

export function sleep(delay: number) {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

export type IsFunction<T, K extends keyof T> = T[K] extends (...args: any[]) => any
  ? true
  : T[K] extends (...args: any[]) => Promise<any>
  ? true
  : false;

export type GetRawPromptReturnType<T extends RawPrompt> = T['parse'] extends undefined
  ? string
  : T['parse'] extends Function
  ? Awaited<ReturnType<T['parse']>>
  : never;

export type PromptReturnType<T extends string | RawPrompt> = T extends string
  ? string
  : T extends RawPrompt<any>
  ? GetRawPromptReturnType<T>
  : never;
