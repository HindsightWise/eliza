// File: tests/marketMonitor.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connection } from '@solana/web3.js';
import { MarketMonitor } from '../src/utils/marketMonitor';
import type { TradingPair, MarketData } from '../src/utils/types';

// Mock dependencies
vi.mock('@elizaos/plugin-trustdb', () => ({
    default: vi.fn(() => ({
        set: vi.fn(),
        get: vi.fn(),
        query: vi.fn()
    }))
}));

vi.mock('@elizaos/plugin-solana', () => ({
    default: vi.fn(() => ({
        getMarketInfo: vi.fn()
    }))
}));

vi.mock('@elizaos/plugin-solana-agentkit', () => ({
    default: vi.fn(() => ({
        getQuote: vi.fn()
    }))
}));

describe('MarketMonitor', () => {
    let marketMonitor: MarketMonitor;
    let mockConnection: Connection;
    let mockTrustDB: any;
    let mockSolanaPlugin: any;
    let mockAgentKit: any;

    const testConfig = {
        timeframes: ['1m', '5m', '15m'],
        updateInterval: 1000,
        indicators: {
            ema: [9, 21],
            rsi: {
                period: 14,
                overbought: 70,
                oversold: 30
            },
            volatility: {
                bbPeriod: 20,
                bbStdDev: 2,
                atrPeriod: 14
            }
        },
        liquidityThreshold: 1000,
        volumeThreshold: 10000,
        alertThresholds: {
            priceChange: 5,
            volumeSpike: 200,
            lowLiquidity: 500
        }
    };

    const testPair: TradingPair = {
        name: 'SOL/USDC',
        baseMint: 'So11111111111111111111111111111111111111112',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        enabled: true
    };

    beforeEach(() => {
        mockConnection = new Connection('http://localhost:8899');
        mockTrustDB = {
            set: vi.fn(),
            get: vi.fn(),
            query: vi.fn()
        };
        mockSolanaPlugin = {
            getMarketInfo: vi.fn()
        };
        mockAgentKit = {
            getQuote: vi.fn()
        };

        marketMonitor = new MarketMonitor(
            mockConnection,
            mockTrustDB,
            mockSolanaPlugin,
            mockAgentKit,
            testConfig
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Market Data Fetching', () => {
        it('should fetch market data successfully', async () => {
            mockAgentKit.getQuote.mockResolvedValue({
                price: 100,
                bestBid: 99.5,
                bestAsk: 100.5
            });

            mockSolanaPlugin.getMarketInfo.mockResolvedValue({
                volume24h: 1000000,
                liquidity: 5000000,
                priceChange24h: 2.5
            });

            const marketData = await marketMonitor['fetchMarketData'](testPair);

            expect(marketData).toBeDefined();
            expect(marketData?.price).toBe(100);
            expect(marketData?.liquidity).toBe(5000000);
        });

        it('should handle failed market data fetch', async () => {
            mockAgentKit.getQuote.mockRejectedValue(new Error('API Error'));
            const marketData = await marketMonitor['fetchMarketData'](testPair);
            expect(marketData).toBeNull();
        });
    });

    describe('Alert Generation', () => {
        it('should generate alerts for significant price changes', async () => {
            const testData: MarketData = {
                price: 100,
                timestamp: Date.now(),
                volume24h: 1000000,
                liquidity: 5000000,
                priceChange24h: 10,
                volatility: 0,
                indicators: {
                    ema: {},
                    rsi: 0,
                    bb: { upper: 0, middle: 0, lower: 0 },
                    atr: 0
                }
            };

            await marketMonitor['checkAlertConditions'](testPair.name, testData);

            expect(mockTrustDB.set).toHaveBeenCalled();
            const alertCall = mockTrustDB.set.mock.calls[0];
            expect(alertCall[1][0].type).toBe('PRICE_CHANGE');
        });
    });
});