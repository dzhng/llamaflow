import { buildMessage } from './persona';

describe('buildMessage', () => {
  it('Should build system message given a persona', () => {
    expect(
      buildMessage({
        prompt: 'You are a helpful assistant.',
      }),
    ).toMatchSnapshot();
  });

  it('Should build system message given a persona and qualifiers', () => {
    expect(
      buildMessage({
        prompt:
          'You are a smart and honest writer for a TV show about the history of Europe. You will write as concisely and clearly as possible, without factual errors.',
        qualifiers: [
          'Write in an engaging and friendly manner, and never say common misconceptions, outdated information, lies, fiction, myths, or memes.',
          'Include any supporting evidence in that aligns with what you are asked to write.',
          "When writing about any person, explain the person's origin in details",
          "Follow the user's requirements carefully & to the letter.",
        ],
      }),
    ).toMatchSnapshot();
  });
});
