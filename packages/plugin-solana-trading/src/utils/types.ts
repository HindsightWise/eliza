// File: src/utils/types.ts

import { Commitment, PublicKey } from '@solana/web3.js';

export interface TradingPair {
    name: string;
    baseMint: string;
    quoteMint: string;
    enabled: boolean;
}

export interface MarketData {
    price: number;
    timestamp: number;
    volume24h: number;
    liquidity: number;
    priceChange24h: number;
    volatility: number;
    indicators: {
        ema: Record<number, number>;
        rsi: number;
        bb: {
            upper: number;
            middle: number;
            lower: number;
        };
        atr: number;
    };
}

export interface TechnicalIndicators {
    ema: number[];
    rsi: {
        period: number;
        overbought: number;
        oversold: number;
    };
    volatility: {
        bbPeriod: number;
        bbStdDev: number;
        atrPeriod: number;
    };
}

export interface MonitoringConfig {
    timeframes: string[];
    indicators: TechnicalIndicators;
    updateInterval: number;
    liquidityThreshold: number;
    volumeThreshold: number;
    alertThresholds: {
        priceChange: number;
        volumeSpike: number;
        lowLiquidity: number;
    };
    debug?: boolean;
}

export interface RiskConfig {
    maxPositionPercentage: number;
    maxLeverage: number;
    targetDailyReturn: number;
    stopLossPercentage: number;
    dailyLossLimit: number;
}

export interface Position {
    id: string;
    pair: string;
    side: 'buy' | 'sell';
    size: number;
    entryPrice: number;
    currentPrice: number;
    status: 'open' | 'closed';
    openTime: number;
    closeTime?: number;
    closeReason?: string;
}

export interface OrderParams {
    pair: string;
    side: 'buy' | 'sell';
    size: number;
    type: 'MARKET' | 'LIMIT';
    price: number;
    stopLoss?: number;
    takeProfit?: number;
}

export interface BotConfig {
    network: {
        cluster: string;
        endpoint: string;
        wsEndpoint: string;
        commitment: Commitment;
    };
    trading: {
        pairs: TradingPair[];
        limits: {
            maxPositionSize: number;
            maxDailyTrades: number;
            maxDrawdown: number;
            stopLoss: number;
            takeProfit: number;
            minLiquidity: number;
            maxVolatility: number;
            maxSpread: number;
        };
    };
    risk: RiskConfig;
    monitoring: MonitoringConfig;
}