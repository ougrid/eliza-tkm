// src/index.ts
import { elizaLogger } from "@ai16z/eliza";
import { generateWebSearch } from "@ai16z/eliza";
var webSearch = {
  name: "WEB_SEARCH",
  similes: [
    "SEARCH_WEB",
    "INTERNET_SEARCH",
    "LOOKUP",
    "QUERY_WEB",
    "FIND_ONLINE",
    "SEARCH_ENGINE",
    "WEB_LOOKUP",
    "ONLINE_SEARCH",
    "FIND_INFORMATION"
  ],
  description: "Perform a web search to find information related to the message.",
  validate: async (runtime, message) => {
    const tavilyApiKeyOk = !!runtime.getSetting("TAVILY_API_KEY");
    return tavilyApiKeyOk;
  },
  handler: async (runtime, message, state, options, callback) => {
    elizaLogger.log("Composing state for message:", message);
    state = await runtime.composeState(message);
    const userId = runtime.agentId;
    elizaLogger.log("User ID:", userId);
    const webSearchPrompt = message.content.text;
    elizaLogger.log("web search prompt received:", webSearchPrompt);
    elizaLogger.log("Generating image with prompt:", webSearchPrompt);
    const searchResponse = await generateWebSearch(
      webSearchPrompt,
      runtime
    );
    if (searchResponse && searchResponse.results.length) {
      const responseList = searchResponse.answer ? `${searchResponse.answer}${Array.isArray(searchResponse.results) && searchResponse.results.length > 0 ? `

For more details, you can check out these resources:
${searchResponse.results.map(
        (result, index) => `${index + 1}. [${result.title}](${result.url})`
      ).join("\n")}` : ""}` : "";
      callback({
        text: responseList
      });
    } else {
      elizaLogger.error("search failed or returned no data.");
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Find the latest news about SpaceX launches."
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here is the latest news about SpaceX launches:",
          action: "WEB_SEARCH"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you find details about the iPhone 16 release?"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here are the details I found about the iPhone 16 release:",
          action: "WEB_SEARCH"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "What is the schedule for the next FIFA World Cup?"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here is the schedule for the next FIFA World Cup:",
          action: "WEB_SEARCH"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Check the latest stock price of Tesla." }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here is the latest stock price of Tesla I found:",
          action: "WEB_SEARCH"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "What are the current trending movies in the US?"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here are the current trending movies in the US:",
          action: "WEB_SEARCH"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "What is the latest score in the NBA finals?"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here is the latest score from the NBA finals:",
          action: "WEB_SEARCH"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "When is the next Apple keynote event?" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Here is the information about the next Apple keynote event:",
          action: "WEB_SEARCH"
        }
      }
    ]
  ]
};
var webSearchPlugin = {
  name: "webSearch",
  description: "Search web",
  actions: [webSearch],
  evaluators: [],
  providers: []
};
export {
  webSearchPlugin
};
//# sourceMappingURL=index.js.map