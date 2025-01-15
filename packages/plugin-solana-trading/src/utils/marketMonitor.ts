import { Connection, PublicKey } from '@solana/web3.js';
import { TrustDB } from '@elizaos/plugin-trustdb';
import { SolanaPlugin } from '@elizaos/plugin-solana';
import { SolanaAgentKit } from '@elizaos/plugin-solana-agentkit';
import { MarketData, TradingPair, MonitoringConfig } from './types';
import { TechnicalAnalysis } from './indicators';
import BigNumber from 'bignumber.js';

export class MarketMonitor {
    private updateIntervals: Map<string, NodeJS.Timer> = new Map();
    private isMonitoring: boolean = false;
    private lastUpdate: Record<string, number> = {};
    private priceHistory: Map<string, {
        prices: number[],
        highs: number[],
        lows: number[],
        volumes: number[]
    }> = new Map();

    constructor(
        private connection: Connection,
        private trustDB: TrustDB,
        private solanaPlugin: SolanaPlugin,
        private agentKit: SolanaAgentKit,
        private config: MonitoringConfig
    ) {}

    async start(pairs: TradingPair[]): Promise<void> {
        console.log('Starting market monitor...');

        try {
            // Initialize monitoring for each trading pair
            for (const pair of pairs) {
                if (!pair.enabled) continue;

                console.log(`Initializing monitoring for ${pair.name}`);
                await this.initializePairMonitoring(pair);
            }

            this.isMonitoring = true;
            console.log('Market monitor started successfully');
        } catch (error) {
            console.error('Failed to start market monitor:', error);
            throw error;
        }
    }

    private async initializePairMonitoring(pair: TradingPair): Promise<void> {
        // Initialize price history storage
        this.priceHistory.set(pair.name, {
            prices: [],
            highs: [],
            lows: [],
            volumes: []
        });

        // Get initial market data
        const initialData = await this.fetchMarketData(pair);
        if (initialData) {
            await this.updateMarketData(pair, initialData);
        }

        // Set up regular monitoring interval
        const timer = setInterval(async () => {
            if (!this.isMonitoring) return;

            try {
                const data = await this.fetchMarketData(pair);
                if (data) {
                    await this.updateMarketData(pair, data);
                }
            } catch (error) {
                console.error(`Error updating ${pair.name}:`, error);
            }
        }, this.config.updateInterval);

        this.updateIntervals.set(pair.name, timer);
    }

    private async fetchMarketData(pair: TradingPair): Promise<MarketData | null> {
        try {
            // Get quote from Jupiter DEX through AgentKit
            const quote = await this.agentKit.getQuote({
                inputMint: pair.baseMint,
                outputMint: pair.quoteMint,
                amount: new BigNumber(1).multipliedBy(1e9).toString() // 1 unit of base currency
            });

            // Get additional market info from Solana plugin
            const marketInfo = await this.solanaPlugin.getMarketInfo(
                pair.baseMint,
                pair.quoteMint
            );

            // Calculate spread percentage
            const spread = new BigNumber(quote.bestAsk)
                .minus(quote.bestBid)
                .dividedBy(quote.bestAsk)
                .multipliedBy(100);

            return {
                price: quote.price,
                timestamp: Date.now(),
                volume24h: marketInfo.volume24h,
                liquidity: marketInfo.liquidity,
                priceChange24h: marketInfo.priceChange24h,
                volatility: 0, // Will be calculated later
                indicators: {
                    ema: {},
                    rsi: 0,
                    bb: { upper: 0, middle: 0, lower: 0 },
                    atr: 0
                }
            };
        } catch (error) {
            console.error(`Error fetching market data for ${pair.name}:`, error);
            return null;
        }
    }

    private async updateMarketData(pair: TradingPair, data: MarketData): Promise<void> {
        const history = this.priceHistory.get(pair.name);
        if (!history) return;

        // Update historical data arrays
        history.prices.push(data.price);
        history.volumes.push(data.volume24h);
        history.highs.push(data.price); // For this basic implementation
        history.lows.push(data.price);  // For this basic implementation

        // Calculate technical indicators
        const enrichedData = await this.calculateIndicators(pair.name, data);

        // Store the enriched market data
        await this.storeMarketData(pair.name, enrichedData);

        // Check for alert conditions
        await this.checkAlertConditions(pair.name, enrichedData);

        // Manage history size
        const maxPeriod = Math.max(
            ...this.config.indicators.ema,
            this.config.indicators.volatility.bbPeriod * 2
        );

        if (history.prices.length > maxPeriod) {
            history.prices = history.prices.slice(-maxPeriod);
            history.highs = history.highs.slice(-maxPeriod);
            history.lows = history.lows.slice(-maxPeriod);
            history.volumes = history.volumes.slice(-maxPeriod);
        }

        this.lastUpdate[pair.name] = Date.now();
    }

    private async calculateIndicators(
        pairName: string,
        data: MarketData
    ): Promise<MarketData> {
        const history = this.priceHistory.get(pairName);
        if (!history) return data;

        // Calculate EMAs for each configured period
        const emaValues: Record<number, number> = {};
        for (const period of this.config.indicators.ema) {
            emaValues[period] = TechnicalAnalysis.calculateEMA(
                history.prices,
                period
            );
        }

        // Calculate RSI
        const rsi = TechnicalAnalysis.calculateRSI(
            history.prices,
            this.config.indicators.rsi.period
        );

        // Calculate Bollinger Bands
        const bb = TechnicalAnalysis.calculateBollingerBands(
            history.prices,
            this.config.indicators.volatility.bbPeriod,
            this.config.indicators.volatility.bbStdDev
        );

        // Calculate ATR
        const atr = TechnicalAnalysis.calculateATR(
            history.highs,
            history.lows,
            history.prices,
            this.config.indicators.volatility.atrPeriod
        );

        // Calculate overall volatility
        const volatility = TechnicalAnalysis.calculateVolatility(
            history.prices,
            this.config.indicators.volatility.bbPeriod
        );

        return {
            ...data,
            volatility,
            indicators: {
                ema: emaValues,
                rsi,
                bb,
                atr
            }
        };
    }

    private async checkAlertConditions(
        pairName: string,
        data: MarketData
    ): Promise<void> {
        const alerts = [];

        // Check for significant price changes
        if (Math.abs(data.priceChange24h) > this.config.alertThresholds.priceChange) {
            alerts.push({
                type: 'PRICE_CHANGE',
                severity: 'HIGH',
                message: `${pairName} price changed by ${data.priceChange24h.toFixed(2)}% in 24h`,
                timestamp: Date.now()
            });
        }

        // Check for volume spikes
        if (data.volume24h > this.config.volumeThreshold *
            this.config.alertThresholds.volumeSpike) {
            alerts.push({
                type: 'VOLUME_SPIKE',
                severity: 'MEDIUM',
                message: `Unusual volume for ${pairName}: $${data.volume24h.toFixed(2)}`,
                timestamp: Date.now()
            });
        }

        // Check for liquidity issues
        if (data.liquidity < this.config.alertThresholds.lowLiquidity) {
            alerts.push({
                type: 'LOW_LIQUIDITY',
                severity: 'HIGH',
                message: `Low liquidity warning for ${pairName}: $${data.liquidity.toFixed(2)}`,
                timestamp: Date.now()
            });
        }

        // Store alerts if any were generated
        if (alerts.length > 0) {
            await this.trustDB.set(`alerts:${pairName}:${Date.now()}`, alerts);

            if (this.config.debug) {
                console.log(`Generated ${alerts.length} alerts for ${pairName}:`, alerts);
            }
        }
    }

    private async storeMarketData(
        pairName: string,
        data: MarketData
    ): Promise<void> {
        try {
            // Store current market data
            await this.trustDB.set(`market:${pairName}:current`, data);

            // Store historical data point
            await this.trustDB.set(
                `market:${pairName}:history:${data.timestamp}`,
                data
            );

            if (this.config.debug) {
                console.log(`Stored market data for ${pairName}:`, {
                    price: data.price,
                    volume: data.volume24h,
                    indicators: {
                        rsi: data.indicators.rsi,
                        volatility: data.volatility
                    }
                });
            }
        } catch (error) {
            console.error(`Error storing market data for ${pairName}:`, error);
        }
    }

    // Public methods for accessing market data
    async getLatestMarketData(pairName: string): Promise<MarketData | null> {
        try {
            return await this.trustDB.get(`market:${pairName}:current`);
        } catch (error) {
            console.error(`Error fetching market data for ${pairName}:`, error);
            return null;
        }
    }

    async getActiveAlerts(pairName: string): Promise<any[]> {
        try {
            const since = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
            const alerts = await this.trustDB.query(
                `alerts:${pairName}:*`,
                (key, value) => value.timestamp >= since
            );
            return Object.values(alerts).flat();
        } catch (error) {
            console.error(`Error fetching alerts for ${pairName}:`, error);
            return [];
        }
    }

    async stop(): Promise<void> {
        console.log('Stopping market monitor...');
        this.isMonitoring = false;

        // Clear all update intervals
        for (const [key, interval] of this.updateIntervals.entries()) {
            clearInterval(interval);
            this.updateIntervals.delete(key);
        }

        console.log('Market monitor stopped successfully');
    }
}