// src/actions.ts
import {
  getDeferredTools,
  addParametersToDescription
} from "@goat-sdk/core";
import {
  generateText,
  ModelClass,
  composeContext,
  generateObjectV2
} from "@ai16z/eliza";
async function getOnChainActions({
  getWalletClient: getWalletClient2,
  plugins,
  chain: chain2,
  supportsSmartWallets
}) {
  const tools = await getDeferredTools({
    plugins,
    wordForTool: "action",
    chain: chain2,
    supportsSmartWallets
  });
  return tools.map((action) => ({
    ...action,
    name: action.name.toUpperCase()
  })).map((tool) => createAction(tool, getWalletClient2));
}
function createAction(tool, getWalletClient2) {
  return {
    name: tool.name,
    similes: [],
    description: tool.description,
    validate: async () => true,
    handler: async (runtime, message, state, options, callback) => {
      try {
        const walletClient = await getWalletClient2(runtime);
        let currentState = state ?? await runtime.composeState(message);
        currentState = await runtime.updateRecentMessageState(currentState);
        const parameterContext = composeParameterContext(
          tool,
          currentState
        );
        const parameters = await generateParameters(
          runtime,
          parameterContext,
          tool
        );
        const parsedParameters = tool.parameters.safeParse(parameters);
        if (!parsedParameters.success) {
          callback?.({
            text: `Invalid parameters for action ${tool.name}: ${parsedParameters.error.message}`,
            content: { error: parsedParameters.error.message }
          });
          return false;
        }
        const result = await tool.method(
          walletClient,
          parsedParameters.data
        );
        const responseContext = composeResponseContext(
          tool,
          result,
          currentState
        );
        const response = await generateResponse(
          runtime,
          responseContext
        );
        callback?.({ text: response, content: result });
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        callback?.({
          text: `Error executing action ${tool.name}: ${errorMessage}`,
          content: { error: errorMessage }
        });
        return false;
      }
    },
    examples: []
  };
}
function composeParameterContext(tool, state) {
  const contextTemplate = `{{recentMessages}}

Given the recent messages, extract the following information for the action "${tool.name}":
${addParametersToDescription("", tool.parameters)}
`;
  return composeContext({ state, template: contextTemplate });
}
async function generateParameters(runtime, context, tool) {
  const { object } = await generateObjectV2({
    runtime,
    context,
    modelClass: ModelClass.LARGE,
    schema: tool.parameters
  });
  return object;
}
function composeResponseContext(tool, result, state) {
  const responseTemplate = `
    # Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

The action "${tool.name}" was executed successfully.
Here is the result:
${JSON.stringify(result)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
  `;
  return composeContext({ state, template: responseTemplate });
}
async function generateResponse(runtime, context) {
  return generateText({
    runtime,
    context,
    modelClass: ModelClass.LARGE
  });
}

// src/index.ts
import { erc20, USDC } from "@goat-sdk/plugin-erc20";

// src/provider.ts
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { viem } from "@goat-sdk/wallet-viem";
var chain = base;
async function getWalletClient(runtime) {
  const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
  if (!privateKey) throw new Error("EVM_PRIVATE_KEY not configured");
  const provider = runtime.getSetting("EVM_PROVIDER_URL");
  if (!provider) throw new Error("EVM_PROVIDER_URL not configured");
  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain,
    transport: http(provider)
  });
  return viem(walletClient);
}
var walletProvider = {
  async get(runtime, message, state) {
    try {
      const walletClient = await getWalletClient(runtime);
      const address = walletClient.getAddress();
      const balance = await walletClient.balanceOf(address);
      return `EVM Wallet Address: ${address}
Balance: ${balance} ETH`;
    } catch (error) {
      console.error("Error in EVM wallet provider:", error);
      return null;
    }
  }
};

// src/index.ts
import { sendETH } from "@goat-sdk/core";
var goatPlugin = {
  name: "[GOAT] Onchain Actions",
  description: "Base integration plugin",
  providers: [walletProvider],
  evaluators: [],
  services: [],
  actions: [
    ...await getOnChainActions({
      getWalletClient,
      // Add plugins here based on what actions you want to use
      // See all available plugins at https://ohmygoat.dev/chains-wallets-plugins#plugins
      plugins: [sendETH(), erc20({ tokens: [USDC] })],
      chain: {
        type: "evm",
        id: chain.id
      }
    })
  ]
};
var src_default = goatPlugin;
export {
  src_default as default,
  goatPlugin
};
//# sourceMappingURL=index.js.map