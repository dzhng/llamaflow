import jsonic from 'jsonic';
import { get } from 'lodash';
import { z } from 'zod';

import type { JSONPrompt, RawPrompt } from '../types';
import { debug } from '../utils';

import {
  extractJSONArrayResponse,
  extractJSONObjectResponse,
} from './extracter';

export default function buildRawPrompt<T extends z.ZodType>(
  prompt: JSONPrompt<T>,
): RawPrompt<z.infer<T>> {
  return {
    message: prompt.message,
    parse: async (response) => {
      try {
        let json: any;
        let extracted: string | undefined;
        if (!prompt.parseResponse) {
          const potientialArray = extractJSONArrayResponse(response.content);
          const potientialObject = extractJSONObjectResponse(response.content);
          // extract the larger text between potiential array and potiential object, we want the parent json object
          extracted =
            (potientialArray?.length ?? 0) > (potientialObject?.length ?? 0)
              ? potientialArray
              : potientialObject;
          if (!extracted) {
            return {
              success: false,
              retryPrompt:
                prompt.retryMessage ??
                'No valid JSON was found, rewrite as valid JSON.',
            };
          }

          json = jsonic(extracted);
        } else {
          json = await prompt.parseResponse(response.content);
        }

        const parsed = prompt.schema.safeParse(json);
        if (parsed.success) {
          return { success: true, data: parsed.data };
        } else {
          debug.error('Error parsing json:', parsed.error, extracted, json);
          const issuesMessage = parsed.error.issues.reduce(
            (prev, issue) =>
              issue.path && issue.path.length > 0
                ? `${prev}\nThere is an issue with the the value "${JSON.stringify(
                    get(json, issue.path),
                  )}", at ${
                    isArray
                      ? `index ${issue.path[0]}`
                      : `path ${issue.path.join('.')}`
                  }. The issue is: ${issue.message}`
                : `\nThe issue is: ${issue.message}`,
            'There is an issue with that response, please rewrite.',
          );
          return {
            success: false,
            retryPrompt: (
              (prompt.retryMessage ?? '') +
              '\n' +
              issuesMessage
            ).trim(),
          };
        }
      } catch (e) {
        debug.error('Error building json prompt:', e);
        return {
          success: false,
          retryPrompt:
            prompt.retryMessage ??
            `No valid JSON ${
              isArray ? 'array' : 'object'
            } was found, rewrite as valid JSON.`,
        };
      }
    },
  };
}
