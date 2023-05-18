import {
  extractBulletPointsResponse,
  extractJSONArrayResponse,
  extractJSONObjectResponse,
} from './extracter';

describe('extractJSONObjectResponse', () => {
  const testJSONObjects = [
    `{
  "Scott Belsky believes that generative AI models like ChatGPT will not end up like web3": true,
  "He thinks that generative AI will reduce the time it takes to complete tasks, unlike web3, which added more friction and work": true,
  "Belsky sees generative AI as being more like the value that collaborative products have brought to the enterprise, and it will reduce the workflow around all job functions": true,
  "He believes that generative AI could enhance the skills of creative individuals, rather than replacing them": true,
  "Belsky speculates that as AI becomes more deeply embedded in the creative process, there may be an audit trail built into the work’s metadata to help users determine what parts were created by AI and what role humans had in the work’s creation": true,
  "However, Belsky thinks that it’s a bit early for enterprise users to trust generative AI because of the need to understand that audit trail, as well as that proper permissions were given by the work’s original creator and any adjacent people such as the models used or other people involved in the content’s creation": true,
  "Ultimately, Belsky thinks that generative AI will be used for practical business use cases that reduce manual work and speed up processes, such as enabling content velocity and personalization": true
}`,
    `{"content":["Bard provides accurate responses, but it’s overshadowed by one error in the demo. GPT-4, on the other hand, has been providing accurate responses since its release. No mistake has been reported until now. GPT-4 is available on the paid version for ChatGPT Plus, while Bard is only for a group of beta testers. Google Bard AI and ChatGPT-4 are the leading AI learning models. While the former is available for limited testers, the latter is for ChatGPT Plus paid subscribers. Both work on natural language processing with a transformative architecture. The most noticeable difference is that Bard is a language model focused on human-like conversations. Meanwhile, GPT-4 is a text and an image-based chatbot that comprehends users’ queries and responds to texts. Bard is integrated into Google’s search engine, while Microsoft Bing Chat uses GPT-4. Another difference is that Bard utilizes recent, real-time data from the web, but GPT-4 has a limited data source until 2021. On the table, GPT-4 is better than Bard, however there are more features left to discover about both platforms.","urls":[{"url":"https://history-computer.com/lamda-vs-chat-gpt-4/","description":"This URL is related to the content because it provides more information about GPT-4 and its use in Microsoft Bing Chat."},{"url":"https://bard.google.com/","description":"This URL is related to the content because it provides more information about Google Bard AI."},{"url":"https://techcrunch.com/2023/03/21/googles-bard-lags-behind-gpt-4-and-claude-in-head-to-head-comparison/","description":"This URL is related to the content because it provides a comparison between Google Bard AI and GPT-4."},{"url":"https://zapier.com/blog/chatgpt-vs-bard/","description":"This URL is related to the content because it provides a comparison between ChatGPT-4 and Google Bard AI."},{"url":"https://www.techtarget.com/whatis/feature/Bard-vs-ChatGPT-Whats-the-difference","description":"This URL is related to the content because it provides a comparison between Google Bard AI and ChatGPT-4."},{"url":"https://www.digitaltrends.com/computing/google-bard-vs-chatgpt-which-is-the-better-ai-chatbot/","description":"This URL is related to the content because it provides a comparison between Google Bard AI and ChatGPT-4."}]}`,
  ];

  for (const testObject of testJSONObjects) {
    it('Should return null when there are no JSON array', () => {
      expect(extractJSONObjectResponse(`hello world! [ "val 1", "val 2" ] end`)).toBe(undefined);
    });

    it('Should extract a JSON object response with no chars in front or behind', () => {
      expect(extractJSONObjectResponse(testObject)).toEqual(testObject);
    });

    it('Should extract when there are chars only in front', () => {
      expect(extractJSONObjectResponse(`text in front ${testObject}`)).toEqual(testObject);
    });

    it('Should extract when there are chars both in front and behind', () => {
      expect(extractJSONObjectResponse(`text in front ${testObject} text behind`)).toEqual(
        testObject,
      );
    });

    it('Should extract where there are only chars behind', () => {
      expect(extractJSONObjectResponse(`${testObject}more text behind`)).toEqual(testObject);
    });
  }
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
