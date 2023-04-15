import { debug as mDebug } from 'debug';

import type { RawPrompt } from './types';

const error = mDebug('llamaflow:error');
const log = mDebug('llamaflow:log');
// eslint-disable-next-line no-console
log.log = console.log.bind(console);

export const debug = {
  error,
  log,
  write: (t: string) =>
    process.env.DEBUG && 'llamaflow:stream'.match(process.env.DEBUG) && process.stdout.write(t),
};

export function sleep(delay: number) {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

export type MaybePromise<T> = Promise<T> | T;

type IsFunction<T, K extends keyof T> = T[K] extends (...args: any[]) => any
  ? true
  : T[K] extends (...args: any[]) => Promise<any>
  ? true
  : false;

type PickData<T> = T extends { data?: any } ? T['data'] : undefined;

type GetRawPromptResponse<T extends RawPrompt> = IsFunction<Required<T>, 'parse'> extends true
  ? Awaited<ReturnType<NonNullable<T['parse']>>>
  : never;

type GetRawPromptDataType<T extends RawPrompt> = GetRawPromptResponse<T> extends object
  ? NonNullable<PickData<GetRawPromptResponse<T>>>
  : never;

export type PromptReturnType<T extends string | RawPrompt> = T extends string
  ? string
  : T extends RawPrompt<any>
  ? GetRawPromptDataType<T>
  : never;
