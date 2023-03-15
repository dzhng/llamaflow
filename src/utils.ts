import { debug as mDebug } from 'debug';

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
