// src/actions/bridge.ts
import {
  createConfig,
  executeRoute,
  getRoutes
} from "@lifi/sdk";

// src/providers/wallet.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits
} from "viem";
import { mainnet, base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
var DEFAULT_CHAIN_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    chain: mainnet,
    rpcUrl: "https://eth.llamarpc.com",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    blockExplorerUrl: "https://etherscan.io"
  },
  base: {
    chainId: 8453,
    name: "Base",
    chain: base,
    rpcUrl: "https://base.llamarpc.com",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    blockExplorerUrl: "https://basescan.org"
  }
};
var getChainConfigs = (runtime) => {
  return runtime.character.settings.chains?.evm || DEFAULT_CHAIN_CONFIGS;
};
var WalletProvider = class {
  chainConfigs;
  currentChain = "ethereum";
  address;
  runtime;
  constructor(runtime) {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    if (!privateKey) throw new Error("EVM_PRIVATE_KEY not configured");
    this.runtime = runtime;
    const account = privateKeyToAccount(privateKey);
    this.address = account.address;
    const createClients = (chain) => {
      const transport = http(getChainConfigs(runtime)[chain].rpcUrl);
      return {
        chain: getChainConfigs(runtime)[chain].chain,
        publicClient: createPublicClient({
          chain: getChainConfigs(runtime)[chain].chain,
          transport
        }),
        walletClient: createWalletClient({
          chain: getChainConfigs(runtime)[chain].chain,
          transport,
          account
        })
      };
    };
    this.chainConfigs = {
      ethereum: createClients("ethereum"),
      base: createClients("base")
    };
  }
  getAddress() {
    return this.address;
  }
  async getWalletBalance() {
    try {
      const client = this.getPublicClient(this.currentChain);
      const walletClient = this.getWalletClient();
      const balance = await client.getBalance({
        address: walletClient.account.address
      });
      return formatUnits(balance, 18);
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return null;
    }
  }
  async connect() {
    return this.runtime.getSetting("EVM_PRIVATE_KEY");
  }
  async switchChain(runtime, chain) {
    const walletClient = this.chainConfigs[this.currentChain].walletClient;
    if (!walletClient) throw new Error("Wallet not connected");
    try {
      await walletClient.switchChain({
        id: getChainConfigs(runtime)[chain].chainId
      });
    } catch (error) {
      if (error.code === 4902) {
        console.log(
          "[WalletProvider] Chain not added to wallet (error 4902) - attempting to add chain first"
        );
        await walletClient.addChain({
          chain: {
            ...getChainConfigs(runtime)[chain].chain,
            rpcUrls: {
              default: {
                http: [getChainConfigs(runtime)[chain].rpcUrl]
              },
              public: {
                http: [getChainConfigs(runtime)[chain].rpcUrl]
              }
            }
          }
        });
        await walletClient.switchChain({
          id: getChainConfigs(runtime)[chain].chainId
        });
      } else {
        throw error;
      }
    }
    this.currentChain = chain;
  }
  getPublicClient(chain) {
    return this.chainConfigs[chain].publicClient;
  }
  getWalletClient() {
    const walletClient = this.chainConfigs[this.currentChain].walletClient;
    if (!walletClient) throw new Error("Wallet not connected");
    return walletClient;
  }
  getCurrentChain() {
    return this.currentChain;
  }
  getChainConfig(chain) {
    return getChainConfigs(this.runtime)[chain];
  }
};
var evmWalletProvider = {
  async get(runtime, message, state) {
    if (!runtime.getSetting("EVM_PRIVATE_KEY")) {
      return null;
    }
    try {
      const walletProvider = new WalletProvider(runtime);
      const address = walletProvider.getAddress();
      const balance = await walletProvider.getWalletBalance();
      return `EVM Wallet Address: ${address}
Balance: ${balance} ETH`;
    } catch (error) {
      console.error("Error in EVM wallet provider:", error);
      return null;
    }
  }
};

// src/templates/index.ts
var transferTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested transfer:
- Chain to execute on (ethereum or base)
- Amount to transfer
- Recipient address
- Token symbol or address (if not native token)

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "chain": "ethereum" | "base" | null,
    "amount": string | null,
    "toAddress": string | null,
    "token": string | null
}
\`\`\`
`;
var bridgeTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token bridge:
- Token symbol or address to bridge
- Source chain (ethereum or base)
- Destination chain (ethereum or base)
- Amount to bridge
- Destination address (if specified)

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "token": string | null,
    "fromChain": "ethereum" | "base" | null,
    "toChain": "ethereum" | "base" | null,
    "amount": string | null,
    "toAddress": string | null
}
\`\`\`
`;
var swapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token swap:
- Input token symbol or address (the token being sold)
- Output token symbol or address (the token being bought)
- Amount to swap
- Chain to execute on (ethereum or base)

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "inputToken": string | null,
    "outputToken": string | null,
    "amount": string | null,
    "chain": "ethereum" | "base" | null,
    "slippage": number | null
}
\`\`\`
`;

// src/actions/bridge.ts
var BridgeAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
    this.config = createConfig({
      integrator: "eliza",
      chains: Object.values(
        getChainConfigs(this.walletProvider.runtime)
      ).map((config) => ({
        id: config.chainId,
        name: config.name,
        key: config.name.toLowerCase(),
        chainType: "EVM",
        nativeToken: {
          ...config.nativeCurrency,
          chainId: config.chainId,
          address: "0x0000000000000000000000000000000000000000",
          coinKey: config.nativeCurrency.symbol
        },
        metamask: {
          chainId: `0x${config.chainId.toString(16)}`,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.blockExplorerUrl]
        },
        diamondAddress: "0x0000000000000000000000000000000000000000",
        coin: config.nativeCurrency.symbol,
        mainnet: true
      }))
    });
  }
  config;
  async bridge(params) {
    const walletClient = this.walletProvider.getWalletClient();
    const [fromAddress] = await walletClient.getAddresses();
    const routes = await getRoutes({
      fromChainId: getChainConfigs(this.walletProvider.runtime)[params.fromChain].chainId,
      toChainId: getChainConfigs(this.walletProvider.runtime)[params.toChain].chainId,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.amount,
      fromAddress,
      toAddress: params.toAddress || fromAddress
    });
    if (!routes.routes.length) throw new Error("No routes found");
    const execution = await executeRoute(routes.routes[0], this.config);
    const process = execution.steps[0]?.execution?.process[0];
    if (!process?.status || process.status === "FAILED") {
      throw new Error("Transaction failed");
    }
    return {
      hash: process.txHash,
      from: fromAddress,
      to: routes.routes[0].steps[0].estimate.approvalAddress,
      value: BigInt(params.amount),
      chainId: getChainConfigs(this.walletProvider.runtime)[params.fromChain].chainId
    };
  }
};
var bridgeAction = {
  name: "bridge",
  description: "Bridge tokens between different chains",
  handler: async (runtime, message, state, options) => {
    const walletProvider = new WalletProvider(runtime);
    const action = new BridgeAction(walletProvider);
    return action.bridge(options);
  },
  template: bridgeTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Bridge 1 ETH from Ethereum to Base",
          action: "CROSS_CHAIN_TRANSFER"
        }
      }
    ]
  ],
  similes: ["CROSS_CHAIN_TRANSFER", "CHAIN_BRIDGE", "MOVE_CROSS_CHAIN"]
};

// src/actions/swap.ts
import {
  createConfig as createConfig2,
  executeRoute as executeRoute2,
  getRoutes as getRoutes2
} from "@lifi/sdk";
var SwapAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
    this.config = createConfig2({
      integrator: "eliza",
      chains: Object.values(
        getChainConfigs(this.walletProvider.runtime)
      ).map((config) => ({
        id: config.chainId,
        name: config.name,
        key: config.name.toLowerCase(),
        chainType: "EVM",
        nativeToken: {
          ...config.nativeCurrency,
          chainId: config.chainId,
          address: "0x0000000000000000000000000000000000000000",
          coinKey: config.nativeCurrency.symbol,
          priceUSD: "0",
          logoURI: "",
          symbol: config.nativeCurrency.symbol,
          decimals: config.nativeCurrency.decimals,
          name: config.nativeCurrency.name
        },
        rpcUrls: {
          public: { http: [config.rpcUrl] }
        },
        blockExplorerUrls: [config.blockExplorerUrl],
        metamask: {
          chainId: `0x${config.chainId.toString(16)}`,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.blockExplorerUrl]
        },
        coin: config.nativeCurrency.symbol,
        mainnet: true,
        diamondAddress: "0x0000000000000000000000000000000000000000"
      }))
    });
  }
  config;
  async swap(params) {
    const walletClient = this.walletProvider.getWalletClient();
    const [fromAddress] = await walletClient.getAddresses();
    const routes = await getRoutes2({
      fromChainId: getChainConfigs(this.walletProvider.runtime)[params.chain].chainId,
      toChainId: getChainConfigs(this.walletProvider.runtime)[params.chain].chainId,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.amount,
      fromAddress,
      options: {
        slippage: params.slippage || 0.5,
        order: "RECOMMENDED"
      }
    });
    if (!routes.routes.length) throw new Error("No routes found");
    const execution = await executeRoute2(routes.routes[0], this.config);
    const process = execution.steps[0]?.execution?.process[0];
    if (!process?.status || process.status === "FAILED") {
      throw new Error("Transaction failed");
    }
    return {
      hash: process.txHash,
      from: fromAddress,
      to: routes.routes[0].steps[0].estimate.approvalAddress,
      value: BigInt(params.amount),
      data: process.data,
      chainId: getChainConfigs(this.walletProvider.runtime)[params.chain].chainId
    };
  }
};
var swapAction = {
  name: "swap",
  description: "Swap tokens on the same chain",
  handler: async (runtime, message, state, options, callback) => {
    try {
      const walletProvider = new WalletProvider(runtime);
      const action = new SwapAction(walletProvider);
      return await action.swap(options);
    } catch (error) {
      console.error("Error in swap handler:", error.message);
      if (callback) {
        callback({ text: `Error: ${error.message}` });
      }
      return false;
    }
  },
  template: swapTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Swap 1 ETH for USDC on Base",
          action: "TOKEN_SWAP"
        }
      }
    ]
  ],
  similes: ["TOKEN_SWAP", "EXCHANGE_TOKENS", "TRADE_TOKENS"]
};

// src/actions/transfer.ts
import { parseEther } from "viem";
var TransferAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
  }
  async transfer(runtime, params) {
    const walletClient = this.walletProvider.getWalletClient();
    const [fromAddress] = await walletClient.getAddresses();
    await this.walletProvider.switchChain(runtime, params.fromChain);
    try {
      const hash = await walletClient.sendTransaction({
        account: fromAddress,
        to: params.toAddress,
        value: parseEther(params.amount),
        data: params.data,
        kzg: {
          blobToKzgCommitment: function(blob) {
            throw new Error("Function not implemented.");
          },
          computeBlobKzgProof: function(blob, commitment) {
            throw new Error("Function not implemented.");
          }
        },
        chain: void 0
      });
      return {
        hash,
        from: fromAddress,
        to: params.toAddress,
        value: parseEther(params.amount),
        data: params.data
      };
    } catch (error) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }
};
var transferAction = {
  name: "transfer",
  description: "Transfer tokens between addresses on the same chain",
  handler: async (runtime, message, state, options) => {
    const walletProvider = new WalletProvider(runtime);
    const action = new TransferAction(walletProvider);
    return action.transfer(runtime, options);
  },
  template: transferTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "assistant",
        content: {
          text: "I'll help you transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          action: "SEND_TOKENS"
        }
      },
      {
        user: "user",
        content: {
          text: "Transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          action: "SEND_TOKENS"
        }
      }
    ]
  ],
  similes: ["SEND_TOKENS", "TOKEN_TRANSFER", "MOVE_TOKENS"]
};

// src/index.ts
var evmPlugin = {
  name: "evm",
  description: "EVM blockchain integration plugin",
  providers: [evmWalletProvider],
  evaluators: [],
  services: [],
  actions: [transferAction, bridgeAction, swapAction]
};
var src_default = evmPlugin;
export {
  BridgeAction,
  DEFAULT_CHAIN_CONFIGS,
  SwapAction,
  TransferAction,
  WalletProvider,
  bridgeAction,
  bridgeTemplate,
  src_default as default,
  evmPlugin,
  evmWalletProvider,
  getChainConfigs,
  swapAction,
  swapTemplate,
  transferAction,
  transferTemplate
};
//# sourceMappingURL=index.js.map