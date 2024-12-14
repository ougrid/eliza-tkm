import * as _ai16z_eliza from '@ai16z/eliza';
import { Provider, Action, Plugin } from '@ai16z/eliza';

declare const massPayoutProvider: Provider;
declare const sendMassPayoutAction: Action;
declare const coinbaseMassPaymentsPlugin: Plugin;

interface ChargeRequest {
    name: string;
    description: string;
    pricing_type: string;
    local_price: {
        amount: string;
        currency: string;
    };
}
declare function createCharge(apiKey: string, params: ChargeRequest): Promise<any>;
declare function getAllCharges(apiKey: string): Promise<any>;
declare function getChargeDetails(apiKey: string, chargeId: string): Promise<any>;
declare const createCoinbaseChargeAction: Action;
declare const getAllChargesAction: Action;
declare const getChargeDetailsAction: Action;
declare const chargeProvider: Provider;
declare const coinbaseCommercePlugin: Plugin;

declare const tradeProvider: Provider;
declare const executeTradeAction: Action;
declare const tradePlugin: Plugin;

declare const deployTokenContractAction: Action;
declare const invokeContractAction: Action;
declare const tokenContractPlugin: Plugin;

declare const webhookProvider: Provider;
declare const createWebhookAction: Action;
declare const webhookPlugin: Plugin;

declare const plugins: {
    coinbaseMassPaymentsPlugin: _ai16z_eliza.Plugin;
    coinbaseCommercePlugin: _ai16z_eliza.Plugin;
    tradePlugin: _ai16z_eliza.Plugin;
    tokenContractPlugin: _ai16z_eliza.Plugin;
    webhookPlugin: _ai16z_eliza.Plugin;
};

export { chargeProvider, coinbaseCommercePlugin, coinbaseMassPaymentsPlugin, createCharge, createCoinbaseChargeAction, createWebhookAction, deployTokenContractAction, executeTradeAction, getAllCharges, getAllChargesAction, getChargeDetails, getChargeDetailsAction, invokeContractAction, massPayoutProvider, plugins, sendMassPayoutAction, tokenContractPlugin, tradePlugin, tradeProvider, webhookPlugin, webhookProvider };
