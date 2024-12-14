import { IAgentRuntime, Client } from '@ai16z/eliza';

declare class AutoClient {
    interval: NodeJS.Timeout;
    runtime: IAgentRuntime;
    constructor(runtime: IAgentRuntime);
}
declare const AutoClientInterface: Client;

export { AutoClient, AutoClientInterface, AutoClientInterface as default };
