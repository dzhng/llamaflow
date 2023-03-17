import jsonic from 'jsonic';
import { get } from 'lodash';
import { z, ZodArray } from 'zod';

import type { JSONPrompt, RawPrompt } from '~/types';

import { extractJSONArrayResponse, extractJSONObjectResponse } from './extracter';

export default function buildRawPrompt<T extends z.ZodType>(
  prompt: JSONPrompt<T>,
): RawPrompt<z.infer<T>> {
  return {
    message: `${prompt.initialMessage} ${prompt.formatMessage}`,
    parse: async response => {
      const isArray = prompt.schema instanceof ZodArray;
      try {
        let json: any;
        if (!prompt.parseResponse) {
          const extracted = isArray
            ? extractJSONArrayResponse(response.content)
            : extractJSONObjectResponse(response.content);
          if (!extracted) {
            return {
              success: false,
              retryPrompt:
                prompt.formatMessage ??
                `No valid JSON ${isArray ? 'array' : 'object'} was found, try again.`,
            };
          }

          json = jsonic(extracted);
        } else {
          json = prompt.parseResponse(response.content);
        }

        const parsed = prompt.schema.safeParse(json);
        if (parsed.success) {
          return { success: true, data: parsed.data };
        } else {
          const issuesMessage = parsed.error.issues.reduce(
            (prev, issue) =>
              `${prev}\nThere is an issue with the the value "${get(json, issue.path)}", at ${
                isArray ? `index ${issue.path[0]}` : `path ${issue.path.join('.')}`
              }. The issue is: ${issue.message}`,
            '',
          );
          return {
            success: false,
            retryPrompt: ((prompt.formatMessage ?? '') + '\n' + issuesMessage).trim(),
          };
        }
      } catch (e) {
        return {
          success: false,
          retryPrompt:
            prompt.formatMessage ??
            `No valid JSON ${isArray ? 'array' : 'object'} was found, try again.`,
        };
      }
    },
  };
}
