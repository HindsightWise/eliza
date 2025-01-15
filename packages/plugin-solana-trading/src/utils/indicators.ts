// File: src/utils/indicators.ts

import { MarketData } from './types';  // Import types we need

export class TechnicalAnalysis {
    // Calculate Exponential Moving Average
    static calculateEMA(prices: number[], period: number): number {
        if (prices.length < period) {
            return prices[prices.length - 1];
        }

        const multiplier = 2 / (period + 1);
        let ema = prices[0];

        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    // Calculate Relative Strength Index
    static calculateRSI(prices: number[], period: number): number {
        if (prices.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        // Calculate initial gains and losses
        for (let i = 1; i < period + 1; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }

        // Calculate initial averages
        let avgGain = gains / period;
        let avgLoss = losses / period;

        // Calculate RSI using Wilder's smoothing method
        for (let i = period + 1; i < prices.length; i++) {
            const difference = prices[i] - prices[i - 1];

            if (difference >= 0) {
                avgGain = ((avgGain * (period - 1)) + difference) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = ((avgLoss * (period - 1)) - difference) / period;
            }
        }

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // Calculate Bollinger Bands
    static calculateBollingerBands(prices: number[], period: number, stdDev: number) {
        if (prices.length < period) {
            const price = prices[prices.length - 1];
            return { upper: price, middle: price, lower: price };
        }

        const relevantPrices = prices.slice(-period);

        // Calculate SMA (middle band)
        const sma = relevantPrices.reduce((a, b) => a + b) / period;

        // Calculate Standard Deviation
        const squaredDifferences = relevantPrices.map(p => Math.pow(p - sma, 2));
        const standardDeviation = Math.sqrt(
            squaredDifferences.reduce((a, b) => a + b) / period
        );

        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }

    // Calculate Average True Range
    static calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
        if (highs.length < 2) return 0;

        // Calculate True Ranges
        const trueRanges = highs.map((high, i) => {
            if (i === 0) return high - lows[i];

            const previousClose = closes[i - 1];
            return Math.max(
                high - lows[i],
                Math.abs(high - previousClose),
                Math.abs(lows[i] - previousClose)
            );
        });

        // Calculate ATR using Wilder's smoothing
        let atr = trueRanges[0];
        for (let i = 1; i < trueRanges.length; i++) {
            atr = ((atr * (period - 1)) + trueRanges[i]) / period;
        }

        return atr;
    }

    // Calculate volatility using standard deviation
    static calculateVolatility(prices: number[], period: number = 20): number {
        if (prices.length < period) return 0;

        const pricesToUse = prices.slice(-period);
        const mean = pricesToUse.reduce((a, b) => a + b) / period;
        const squaredDiffs = pricesToUse.map(p => Math.pow(p - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / period);
    }

    // Detect support and resistance levels
    static findSupportResistance(prices: number[], period: number = 20): {
        supports: number[];
        resistances: number[];
    } {
        const supports: number[] = [];
        const resistances: number[] = [];

        for (let i = period; i < prices.length - period; i++) {
            const currentPrice = prices[i];
            const leftPrices = prices.slice(i - period, i);
            const rightPrices = prices.slice(i + 1, i + period + 1);

            // Check for local minimums (support)
            if (currentPrice < Math.min(...leftPrices) &&
                currentPrice < Math.min(...rightPrices)) {
                supports.push(currentPrice);
            }

            // Check for local maximums (resistance)
            if (currentPrice > Math.max(...leftPrices) &&
                currentPrice > Math.max(...rightPrices)) {
                resistances.push(currentPrice);
            }
        }

        return { supports, resistances };
    }
}