import {
  extractBulletPointsResponse,
  extractJSONArrayResponse,
  extractJSONObjectResponse,
} from './extracter';
import { testJSONObjects } from './extracter.test.data';

describe('extractJSONObjectResponse', () => {
  for (const testObject of testJSONObjects) {
    it('Should return null when there are no JSON array', () => {
      expect(
        extractJSONObjectResponse(`hello world! [ "val 1", "val 2" ] end`),
      ).toBe(undefined);
    });

    it('Should extract a JSON object response with no chars in front or behind', () => {
      expect(extractJSONObjectResponse(testObject)).toEqual(testObject);
    });

    it('Should extract when there are chars only in front', () => {
      expect(extractJSONObjectResponse(`text in front ${testObject}`)).toEqual(
        testObject,
      );
    });

    it('Should extract when there are chars both in front and behind', () => {
      expect(
        extractJSONObjectResponse(`text in front ${testObject} text behind`),
      ).toEqual(testObject);
    });

    it('Should extract where there are only chars behind', () => {
      expect(
        extractJSONObjectResponse(`${testObject}more text behind`),
      ).toEqual(testObject);
    });
  }
});

describe('extratJSONArrayResponse', () => {
  const testJSONArray = `["statement 1", "statement 2", "statement 3"]`;

  it('Should return null when there are no JSON array', () => {
    expect(
      extractJSONArrayResponse(`hello world! { "key": "value" } end`),
    ).toBe(undefined);
  });

  it('Should extract a JSON array response with no chars in front or behind', () => {
    expect(extractJSONArrayResponse(testJSONArray)).toEqual(testJSONArray);
  });

  it('Should extract when there are chars both in front and behind', () => {
    expect(
      extractJSONArrayResponse(`text in front ${testJSONArray} text behind`),
    ).toEqual(testJSONArray);
  });
});

describe('extractBulletPointsResponse', () => {
  const testString = `
  - bullet point 1
  - bullet point 2
  - bullet point 3 - with another dash in the middle.
  `;

  it('Should extract bullet point string into an array', () => {
    expect(extractBulletPointsResponse(testString)).toEqual([
      'bullet point 1',
      'bullet point 2',
      'bullet point 3 - with another dash in the middle.',
    ]);
  });
});
