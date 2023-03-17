import {
  extractBulletPointsResponse,
  extractJSONArrayResponse,
  extractJSONObjectResponse,
} from './extracter';

describe('extractJSONObjectResponse', () => {
  const testJSONObject = `{
  "Scott Belsky believes that generative AI models like ChatGPT will not end up like web3": true,
  "He thinks that generative AI will reduce the time it takes to complete tasks, unlike web3, which added more friction and work": true,
  "Belsky sees generative AI as being more like the value that collaborative products have brought to the enterprise, and it will reduce the workflow around all job functions": true,
  "He believes that generative AI could enhance the skills of creative individuals, rather than replacing them": true,
  "Belsky speculates that as AI becomes more deeply embedded in the creative process, there may be an audit trail built into the work’s metadata to help users determine what parts were created by AI and what role humans had in the work’s creation": true,
  "However, Belsky thinks that it’s a bit early for enterprise users to trust generative AI because of the need to understand that audit trail, as well as that proper permissions were given by the work’s original creator and any adjacent people such as the models used or other people involved in the content’s creation": true,
  "Ultimately, Belsky thinks that generative AI will be used for practical business use cases that reduce manual work and speed up processes, such as enabling content velocity and personalization": true
}`;

  it('Should return null when there are no JSON array', () => {
    expect(extractJSONObjectResponse(`hello world! [ "val 1", "val 2" ] end`)).toBe(undefined);
  });

  it('Should extract a JSON object response with no chars in front or behind', () => {
    expect(extractJSONObjectResponse(testJSONObject)).toEqual(testJSONObject);
  });

  it('Should extract when there are chars only in front', () => {
    expect(extractJSONObjectResponse(`text in front ${testJSONObject}`)).toEqual(testJSONObject);
  });

  it('Should extract when there are chars both in front and behind', () => {
    expect(extractJSONObjectResponse(`text in front ${testJSONObject} text behind`)).toEqual(
      testJSONObject,
    );
  });

  it('Should extract where there are only chars behind', () => {
    expect(extractJSONObjectResponse(`${testJSONObject}more text behind`)).toEqual(testJSONObject);
  });
});

describe('extratJSONArrayResponse', () => {
  const testJSONArray = `["statement 1", "statement 2", "statement 3"]`;

  it('Should return null when there are no JSON array', () => {
    expect(extractJSONArrayResponse(`hello world! { "key": "value" } end`)).toBe(undefined);
  });

  it('Should extract a JSON array response with no chars in front or behind', () => {
    expect(extractJSONArrayResponse(testJSONArray)).toEqual(testJSONArray);
  });

  it('Should extract when there are chars both in front and behind', () => {
    expect(extractJSONArrayResponse(`text in front ${testJSONArray} text behind`)).toEqual(
      testJSONArray,
    );
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
