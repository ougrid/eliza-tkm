import { IAgentRuntime, Provider, Memory, State, Plugin } from '@ai16z/eliza';
import { Hash, Address, Chain, PublicClient, HttpTransport, Account, WalletClient } from 'viem';
import { Token } from '@lifi/types';

type SupportedChain = "ethereum" | "base";
interface Transaction {
    hash: Hash;
    from: Address;
    to: Address;
    value: bigint;
    data?: `0x${string}`;
    chainId?: number;
}
interface TokenWithBalance {
    token: Token;
    balance: bigint;
    formattedBalance: string;
    priceUSD: string;
    valueUSD: string;
}
interface WalletBalance {
    chain: SupportedChain;
    address: Address;
    totalValueUSD: string;
    tokens: TokenWithBalance[];
}
interface ChainMetadata {
    chainId: number;
    name: string;
    chain: Chain;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrl: string;
}
interface ChainConfig {
    chain: Chain;
    publicClient: PublicClient<HttpTransport, Chain, Account | undefined>;
    walletClient?: WalletClient;
}
interface TransferParams {
    fromChain: SupportedChain;
    toAddress: Address;
    amount: string;
    data?: `0x${string}`;
}
interface SwapParams {
    chain: SupportedChain;
    fromToken: Address;
    toToken: Address;
    amount: string;
    slippage?: number;
}
interface BridgeParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    fromToken: Address;
    toToken: Address;
    amount: string;
    toAddress?: Address;
}
interface EvmPluginConfig {
    rpcUrl?: {
        ethereum?: string;
        base?: string;
    };
    secrets?: {
        EVM_PRIVATE_KEY: string;
    };
    testMode?: boolean;
    multicall?: {
        batchSize?: number;
        wait?: number;
    };
}
type LiFiStatus = {
    status: "PENDING" | "DONE" | "FAILED";
    substatus?: string;
    error?: Error;
};
type LiFiRoute = {
    transactionHash: Hash;
    transactionData: `0x${string}`;
    toAddress: Address;
    status: LiFiStatus;
};
interface TokenData extends Token {
    symbol: string;
    decimals: number;
    address: Address;
    name: string;
    logoURI?: string;
    chainId: number;
}
interface TokenPriceResponse {
    priceUSD: string;
    token: TokenData;
}
interface TokenListResponse {
    tokens: TokenData[];
}
interface ProviderError extends Error {
    code?: number;
    data?: unknown;
}

declare const DEFAULT_CHAIN_CONFIGS: Record<SupportedChain, ChainMetadata>;
declare const getChainConfigs: (runtime: IAgentRuntime) => Record<SupportedChain, ChainMetadata> | ChainConfig[];
declare class WalletProvider {
    private chainConfigs;
    private currentChain;
    private address;
    runtime: IAgentRuntime;
    constructor(runtime: IAgentRuntime);
    getAddress(): Address;
    getWalletBalance(): Promise<string | null>;
    connect(): Promise<`0x${string}`>;
    switchChain(runtime: IAgentRuntime, chain: SupportedChain): Promise<void>;
    getPublicClient(chain: SupportedChain): PublicClient<HttpTransport, Chain, Account | undefined>;
    getWalletClient(): WalletClient;
    getCurrentChain(): SupportedChain;
    getChainConfig(chain: SupportedChain): any;
}
declare const evmWalletProvider: Provider;

declare const transferTemplate = "Given the recent messages and wallet information below:\n\n{{recentMessages}}\n\n{{walletInfo}}\n\nExtract the following information about the requested transfer:\n- Chain to execute on (ethereum or base)\n- Amount to transfer\n- Recipient address\n- Token symbol or address (if not native token)\n\nRespond with a JSON markdown block containing only the extracted values:\n\n```json\n{\n    \"chain\": \"ethereum\" | \"base\" | null,\n    \"amount\": string | null,\n    \"toAddress\": string | null,\n    \"token\": string | null\n}\n```\n";
declare const bridgeTemplate = "Given the recent messages and wallet information below:\n\n{{recentMessages}}\n\n{{walletInfo}}\n\nExtract the following information about the requested token bridge:\n- Token symbol or address to bridge\n- Source chain (ethereum or base)\n- Destination chain (ethereum or base)\n- Amount to bridge\n- Destination address (if specified)\n\nRespond with a JSON markdown block containing only the extracted values:\n\n```json\n{\n    \"token\": string | null,\n    \"fromChain\": \"ethereum\" | \"base\" | null,\n    \"toChain\": \"ethereum\" | \"base\" | null,\n    \"amount\": string | null,\n    \"toAddress\": string | null\n}\n```\n";
declare const swapTemplate = "Given the recent messages and wallet information below:\n\n{{recentMessages}}\n\n{{walletInfo}}\n\nExtract the following information about the requested token swap:\n- Input token symbol or address (the token being sold)\n- Output token symbol or address (the token being bought)\n- Amount to swap\n- Chain to execute on (ethereum or base)\n\nRespond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:\n\n```json\n{\n    \"inputToken\": string | null,\n    \"outputToken\": string | null,\n    \"amount\": string | null,\n    \"chain\": \"ethereum\" | \"base\" | null,\n    \"slippage\": number | null\n}\n```\n";

declare class BridgeAction {
    private walletProvider;
    private config;
    constructor(walletProvider: WalletProvider);
    bridge(params: BridgeParams): Promise<Transaction>;
}
declare const bridgeAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any) => Promise<Transaction>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare class SwapAction {
    private walletProvider;
    private config;
    constructor(walletProvider: WalletProvider);
    swap(params: SwapParams): Promise<Transaction>;
}
declare const swapAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any) => Promise<false | Transaction>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare class TransferAction {
    private walletProvider;
    constructor(walletProvider: WalletProvider);
    transfer(runtime: IAgentRuntime, params: TransferParams): Promise<Transaction>;
}
declare const transferAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any) => Promise<Transaction>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare const evmPlugin: Plugin;

export { BridgeAction, type BridgeParams, type ChainConfig, type ChainMetadata, DEFAULT_CHAIN_CONFIGS, type EvmPluginConfig, type LiFiRoute, type LiFiStatus, type ProviderError, type SupportedChain, SwapAction, type SwapParams, type TokenData, type TokenListResponse, type TokenPriceResponse, type TokenWithBalance, type Transaction, TransferAction, type TransferParams, type WalletBalance, WalletProvider, bridgeAction, bridgeTemplate, evmPlugin as default, evmPlugin, evmWalletProvider, getChainConfigs, swapAction, swapTemplate, transferAction, transferTemplate };
