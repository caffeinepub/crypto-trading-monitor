import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface backendInterface {
    cancelOrder(apiKey: string, _apiSecret: string, symbol: string, orderId: string): Promise<{
        status: string;
        message: string;
    }>;
    now(): Promise<bigint>;
    placeLimitOrder(apiKey: string, _apiSecret: string, symbol: string, side: string, quantity: string, price: string): Promise<{
        status: string;
        message: string;
    }>;
    placeMarketOrder(apiKey: string, _apiSecret: string, symbol: string, side: string, quantity: string): Promise<{
        status: string;
        message: string;
    }>;
    placeStopMarketOrder(apiKey: string, _apiSecret: string, symbol: string, side: string, quantity: string, stopPrice: string): Promise<{
        status: string;
        message: string;
    }>;
    placeTakeProfitMarketOrder(apiKey: string, _apiSecret: string, symbol: string, side: string, quantity: string, stopPrice: string): Promise<{
        status: string;
        message: string;
    }>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
