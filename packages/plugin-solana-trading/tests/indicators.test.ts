// File: tests/indicators.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalAnalysis } from '../src/utils/indicators';

describe('TechnicalAnalysis', () => {
    describe('EMA Calculation', () => {
        it('should calculate EMA correctly', () => {
            const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const period = 5;
            const ema = TechnicalAnalysis.calculateEMA(prices, period);
            expect(ema).toBeCloseTo(8.54, 1); // Expecting approximately 8.54
        });

        it('should handle insufficient data', () => {
            const prices = [1, 2];
            const period = 5;
            const ema = TechnicalAnalysis.calculateEMA(prices, period);
            expect(ema).toBe(2); // Should return last price when insufficient data
        });
    });

    describe('RSI Calculation', () => {
        it('should calculate RSI correctly', () => {
            const prices = [
                45, 46, 47, 44, 43, 44, 45, 46, 47, 48,
                49, 48, 47, 46, 45, 44, 43, 42, 41, 40
            ];
            const period = 14;
            const rsi = TechnicalAnalysis.calculateRSI(prices, period);

            expect(rsi).toBeGreaterThanOrEqual(0);
            expect(rsi).toBeLessThanOrEqual(100);
            expect(rsi).toBeCloseTo(35.56, 1); // Expected RSI for this sequence
        });

        it('should handle insufficient data', () => {
            const prices = [45, 46, 47];
            const period = 14;
            const rsi = TechnicalAnalysis.calculateRSI(prices, period);
            expect(rsi).toBe(50); // Default value for insufficient data
        });
    });

    describe('Bollinger Bands Calculation', () => {
        it('should calculate Bollinger Bands correctly', () => {
            const prices = Array.from({length: 20}, (_, i) => i + 1);
            const period = 20;
            const stdDev = 2;
            const bb = TechnicalAnalysis.calculateBollingerBands(prices, period, stdDev);

            expect(bb.middle).toBeGreaterThan(bb.lower);
            expect(bb.upper).toBeGreaterThan(bb.middle);
            // Middle band should be average of prices
            expect(bb.middle).toBeCloseTo(10.5);
        });

        it('should handle insufficient data', () => {
            const prices = [1, 2];
            const period = 20;
            const stdDev = 2;
            const bb = TechnicalAnalysis.calculateBollingerBands(prices, period, stdDev);

            expect(bb.upper).toBe(2);
            expect(bb.middle).toBe(2);
            expect(bb.lower).toBe(2);
        });
    });

    describe('ATR Calculation', () => {
        it('should calculate ATR correctly', () => {
            const highs = [10, 11, 12, 13, 14];
            const lows = [9, 10, 11, 12, 13];
            const closes = [9.5, 10.5, 11.5, 12.5, 13.5];
            const period = 5;
            const atr = TechnicalAnalysis.calculateATR(highs, lows, closes, period);

            expect(atr).toBeGreaterThan(0);
            expect(atr).toBeLessThan(2);
        });

        it('should handle insufficient data', () => {
            const highs = [10];
            const lows = [9];
            const closes = [9.5];
            const period = 5;
            const atr = TechnicalAnalysis.calculateATR(highs, lows, closes, period);

            expect(atr).toBe(0);
        });
    });

    describe('Volatility Calculation', () => {
        it('should calculate volatility correctly', () => {
            const prices = [10, 11, 10, 12, 9, 13, 8, 14, 7, 15];
            const period = 10;
            const volatility = TechnicalAnalysis.calculateVolatility(prices, period);

            expect(volatility).toBeGreaterThan(0);
            expect(volatility).toBeCloseTo(2.32, 1);
        });

        it('should handle low volatility scenario', () => {
            const prices = [10, 10, 10, 10, 10];
            const period = 5;
            const volatility = TechnicalAnalysis.calculateVolatility(prices, period);

            expect(volatility).toBe(0);
        });
    });

    describe('Support and Resistance Detection', () => {
        it('should detect support and resistance levels', () => {
            const prices = [
                10, 11, 12, 11, 10, 9, 8, 9, 10, 11,
                12, 13, 12, 11, 10, 9, 8, 7, 8, 9
            ];
            const { supports, resistances } = TechnicalAnalysis.findSupportResistance(prices);

            expect(supports.length).toBeGreaterThan(0);
            expect(resistances.length).toBeGreaterThan(0);
        });
    });
});