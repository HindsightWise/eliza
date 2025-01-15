// File: eliza/packages/plugin-solana-trading/src/index.ts

import { Plugin, PluginContext } from '@elizaos/core';
import { Connection, PublicKey } from '@solana/web3.js';
import { TrustDB } from '@elizaos/plugin-trustdb';
import { SolanaPlugin } from '@elizaos/plugin-solana';
import { SolanaAgentKit } from '@elizaos/plugin-solana-agentkit';
import BigNumber from 'bignumber.js';
import { MarketMonitor } from './utils/marketMonitor';

// Define interfaces for configuration and data structures
interface TradingPair {
    name: string;
    baseMint: string;
    quoteMint: string;
    enabled: boolean;
}

interface MarketData {
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

interface RiskConfig {
    maxPositionPercentage: number;
    maxLeverage: number;
    targetDailyReturn: number;
    stopLossPercentage: number;
    dailyLossLimit: number;
}

interface BotConfig {
    network: {
        cluster: string;
        endpoint: string;
        wsEndpoint: string;
        commitment: string;
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
    monitoring: {
        updateInterval: number;
        indicators: {
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
        };
    };
}

export class SolanaTradingBot implements Plugin {
    private connection: Connection;
    private config: BotConfig;
    private trustDB: TrustDB;
    private solanaPlugin: SolanaPlugin;
    private agentKit: SolanaAgentKit;
    private marketMonitor: MarketMonitor;
    private isRunning: boolean = false;

    // Risk management configuration with conservative settings
    private riskConfig: RiskConfig = {
        maxPositionPercentage: 0.01,    // 1% max position size
        maxLeverage: 3.3,               // 3.3x max leverage
        targetDailyReturn: 0.01,        // 1% daily target
        stopLossPercentage: 0.005,      // 0.5% stop loss
        dailyLossLimit: 0.02            // 2% maximum daily loss
    };

    constructor(private context: PluginContext) {
        // Initialize plugin dependencies
        this.trustDB = this.context.getPlugin('trustdb') as TrustDB;
        this.solanaPlugin = this.context.getPlugin('solana') as SolanaPlugin;
        this.agentKit = this.context.getPlugin('solana-agentkit') as SolanaAgentKit;

        // Load configuration
        this.config = this.context.config.get('settings');

        // Apply risk configuration
        this.config.risk = this.riskConfig;
    }

    async start(): Promise<void> {
        console.log('Starting Solana Trading Bot with conservative risk management...');

        try {
            // Initialize Solana connection
            this.connection = new Connection(
                this.config.network.endpoint,
                this.config.network.commitment
            );

            // Initialize market monitor
            this.marketMonitor = new MarketMonitor(
                this.connection,
                this.trustDB,
                this.solanaPlugin,
                this.agentKit,
                this.config.monitoring
            );

            // Start market monitoring
            await this.marketMonitor.start(this.config.trading.pairs);

            // Set up trading logic with risk management
            this.setupTradingLogic();

            this.isRunning = true;
            console.log('Trading bot started successfully');
        } catch (error) {
            console.error('Failed to start trading bot:', error);
            throw error;
        }
    }

    private setupTradingLogic(): void {
        // Run trading evaluation every minute
        setInterval(async () => {
            if (!this.isRunning) return;

            for (const pair of this.config.trading.pairs) {
                try {
                    // Get latest market data and alerts
                    const marketData = await this.marketMonitor.getLatestMarketData(pair.name);
                    const alerts = await this.marketMonitor.getActiveAlerts(pair.name);

                    if (marketData) {
                        await this.evaluateTradeOpportunities(pair, marketData, alerts);
                    }
                } catch (error) {
                    console.error(`Error processing ${pair.name}:`, error);
                }
            }
        }, 60000); // Check every minute
    }

    private async evaluateTradeOpportunities(
        pair: TradingPair,
        marketData: MarketData,
        alerts: any[]
    ): Promise<void> {
        // First, check if we should be trading at all
        if (!await this.isMarketSuitableForTrading(marketData)) {
            console.log(`Market conditions unsuitable for ${pair.name} - skipping evaluation`);
            return;
        }

        // Check daily trade limits and drawdown
        if (!this.canTrade()) {
            console.log('Daily limits reached or drawdown protection active');
            return;
        }

        // Analyze current market conditions
        const analysis = await this.analyzeTechnicalIndicators(marketData);

        // Calculate safe position size based on our 1% rule
        const positionSize = this.calculateConservativePosition(
            marketData.price,
            analysis.confidence
        );

        if (analysis.shouldTrade && positionSize > 0) {
            await this.executeOrder(
                pair,
                analysis.direction,
                positionSize,
                marketData.price,
                this.calculateStopLoss(marketData.price, analysis.direction),
                this.calculateTakeProfit(marketData.price, analysis.direction)
            );
        }
    }

    private async isMarketSuitableForTrading(marketData: MarketData): Promise<boolean> {
        return (
            marketData.liquidity >= this.config.trading.limits.minLiquidity &&
            marketData.volatility <= this.config.trading.limits.maxVolatility
        );
    }

    private canTrade(): boolean {
        // Implement daily trade limit and drawdown checks
        return true; // Placeholder - implement your specific checks
    }

    private async analyzeTechnicalIndicators(marketData: MarketData): Promise<{
        shouldTrade: boolean;
        direction: 'buy' | 'sell';
        confidence: number;
    }> {
        // Example implementation - replace with your strategy
        const rsiOverSold = marketData.indicators.rsi < 30;
        const rsiBuySignal = marketData.indicators.rsi < 40;
        const rsiSellSignal = marketData.indicators.rsi > 60;

        return {
            shouldTrade: rsiOverSold,
            direction: rsiBuySignal ? 'buy' : 'sell',
            confidence: 0.8
        };
    }

    private calculateConservativePosition(price: number, confidence: number): number {
        // Get available capital (implement this based on your system)
        const availableCapital = 1000; // Example value

        // Never risk more than 1% of capital per trade
        const maxPosition = availableCapital * this.riskConfig.maxPositionPercentage;

        // Scale position by confidence
        return maxPosition * confidence;
    }

    private calculateStopLoss(price: number, direction: 'buy' | 'sell'): number {
        const stopLossPercentage = this.riskConfig.stopLossPercentage;
        return direction === 'buy'
            ? price * (1 - stopLossPercentage)
            : price * (1 + stopLossPercentage);
    }

    private calculateTakeProfit(price: number, direction: 'buy' | 'sell'): number {
        const takeProfitPercentage = this.riskConfig.targetDailyReturn;
        return direction === 'buy'
            ? price * (1 + takeProfitPercentage)
            : price * (1 - takeProfitPercentage);
    }
    private async executeOrder(
        pair: TradingPair,
        side: 'buy' | 'sell',
        size: number,
        price: number,
        stopLoss: number,
        takeProfit: number
    ): Promise<void> {
        try {
            // Create the order with the Jupiter DEX through AgentKit
            const order = await this.agentKit.createOrder({
                pair: pair.name,
                side: side,
                size: size,
                type: 'LIMIT',
                price: price,
                stopLoss: stopLoss,
                takeProfit: takeProfit
            });

            // Store order information in TrustDB
            await this.trustDB.set(`orders:${order.id}`, {
                pair: pair.name,
                side: side,
                size: size,
                entryPrice: price,
                stopLoss: stopLoss,
                takeProfit: takeProfit,
                timestamp: Date.now(),
                status: 'open'
            });

            console.log(`Order executed for ${pair.name}:`, {
                side: side,
                size: size,
                price: price,
                stopLoss: stopLoss,
                takeProfit: takeProfit
            });
        } catch (error) {
            console.error('Error executing order:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        console.log('Stopping trading bot...');
        this.isRunning = false;

        if (this.marketMonitor) {
            await this.marketMonitor.stop();
        }

        // Close any open positions if necessary
        await this.closeAllPositions();

        console.log('Trading bot stopped successfully');
    }

    private async closeAllPositions(): Promise<void> {
        try {
            const openPositions = await this.getAllOpenPositions();
            for (const position of openPositions) {
                await this.closePosition(
                    position.pair,
                    position,
                    'Bot shutdown'
                );
            }
        } catch (error) {
            console.error('Error closing positions:', error);
        }
    }
}

export default SolanaTradingBot;