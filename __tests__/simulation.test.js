import { describe, it, expect } from '@jest/globals';
import {
  MIN_OFFSET,
  MAX_OFFSET,
  isValidPrice,
  cleanNumber,
  getRealPrice,
  isSimulatedOffset,
  adaptiveStep,
  stepPct,
  clampOffset,
  applyScrollOffset,
  getEffectivePrice,
  computeSnapshot,
  formatPrice,
  formatUsd,
  formatPercent
} from '../app/utils/simulation.js';

describe('isValidPrice', () => {
  it('accepts positive finite numbers', () => {
    expect(isValidPrice(2500)).toBe(true);
    expect(isValidPrice(0.00001)).toBe(true);
  });

  it('rejects zero, negatives, null, NaN, Infinity and non numbers', () => {
    expect(isValidPrice(0)).toBe(false);
    expect(isValidPrice(-10)).toBe(false);
    expect(isValidPrice(null)).toBe(false);
    expect(isValidPrice(undefined)).toBe(false);
    expect(isValidPrice(NaN)).toBe(false);
    expect(isValidPrice(Infinity)).toBe(false);
    expect(isValidPrice('2500')).toBe(false);
  });
});

describe('cleanNumber', () => {
  it('trims floating point noise', () => {
    expect(cleanNumber(0.1 + 0.2)).toBe(0.3);
    expect(cleanNumber(2500.3172837999998)).toBe(2500.317284);
  });

  it('returns 0 for non usable values', () => {
    expect(cleanNumber(NaN)).toBe(0);
    expect(cleanNumber(Infinity)).toBe(0);
    expect(cleanNumber('10')).toBe(0);
    expect(cleanNumber(undefined)).toBe(0);
  });
});

describe('getRealPrice', () => {
  const precios = {
    BTC: { price: 60000, change24h: 1.2 },
    ETH: { price: 2500, change24h: -0.4 },
    ZEC: null
  };

  it('returns the price of a known symbol', () => {
    expect(getRealPrice(precios, 'ETH')).toBe(2500);
  });

  it('returns null for missing, null or invalid entries', () => {
    expect(getRealPrice(precios, 'DOGE')).toBeNull();
    expect(getRealPrice(precios, 'ZEC')).toBeNull();
    expect(getRealPrice({}, 'ETH')).toBeNull();
    expect(getRealPrice(undefined, 'ETH')).toBeNull();
  });

  it('returns null when the price is not a positive number', () => {
    expect(getRealPrice({ ETH: { price: 0 } }, 'ETH')).toBeNull();
    expect(getRealPrice({ ETH: { price: null } }, 'ETH')).toBeNull();
  });
});

describe('isSimulatedOffset', () => {
  it('is true only for non zero finite offsets', () => {
    expect(isSimulatedOffset(12.5)).toBe(true);
    expect(isSimulatedOffset(-8)).toBe(true);
    expect(isSimulatedOffset(0)).toBe(false);
    expect(isSimulatedOffset(undefined)).toBe(false);
    expect(isSimulatedOffset(NaN)).toBe(false);
  });
});

describe('adaptiveStep', () => {
  it('rounds down to a legible 1-2-5 scale so the step never exceeds 1%', () => {
    expect(adaptiveStep(60000)).toBe(500);
    expect(adaptiveStep(2500)).toBe(20);
    expect(adaptiveStep(150)).toBe(1);
    expect(adaptiveStep(0.35)).toBe(0.002);
    expect(adaptiveStep(1)).toBe(0.01);
  });

  it('never returns a step bigger than 1% of the price', () => {
    [60000, 42000, 2500, 999, 150, 27.5, 3.21, 0.35, 0.0041].forEach(price => {
      expect(adaptiveStep(price)).toBeLessThanOrEqual(price * 0.01);
    });
  });

  it('returns 0 for unusable prices', () => {
    expect(adaptiveStep(0)).toBe(0);
    expect(adaptiveStep(-1)).toBe(0);
    expect(adaptiveStep(null)).toBe(0);
  });
});

describe('stepPct', () => {
  it('keeps the same order of magnitude across asset prices', () => {
    const pcts = [60000, 2500, 150, 27.5, 3.21, 0.35].map(stepPct);
    pcts.forEach(pct => {
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThanOrEqual(1);
    });
  });

  it('matches the conversion of the adaptive step', () => {
    expect(stepPct(2500)).toBe(0.8);
    expect(stepPct(60000)).toBe(0.8333333333);
  });

  it('returns 0 for unusable prices', () => {
    expect(stepPct(0)).toBe(0);
    expect(stepPct(-5)).toBe(0);
  });
});

describe('clampOffset', () => {
  it('clamps to the simulation bounds', () => {
    expect(clampOffset(50)).toBe(50);
    expect(clampOffset(-5000)).toBe(MIN_OFFSET);
    expect(clampOffset(50000)).toBe(MAX_OFFSET);
  });

  it('normalizes invalid offsets to 0', () => {
    expect(clampOffset(NaN)).toBe(0);
    expect(clampOffset(undefined)).toBe(0);
  });
});

describe('applyScrollOffset', () => {
  it('moves the offset one step per tick in the given direction', () => {
    const up = applyScrollOffset(0, 1, 2500);
    const down = applyScrollOffset(0, -1, 2500);

    expect(up).toBeCloseTo(0.8, 5);
    expect(down).toBeCloseTo(-0.8, 5);
  });

  it('accumulates additively so N ticks means N steps', () => {
    let offset = 0;
    for (let i = 0; i < 10; i++) offset = applyScrollOffset(offset, 1, 2500);

    expect(offset).toBeCloseTo(8, 5);
  });

  it('multiplies the step when fast is enabled', () => {
    expect(applyScrollOffset(0, 1, 2500, { fast: true })).toBeCloseTo(4, 5);
  });

  it('accepts multiple steps at once for swipe gestures', () => {
    expect(applyScrollOffset(0, 1, 2500, { steps: 3 })).toBeCloseTo(2.4, 5);
    expect(applyScrollOffset(0, -1, 2500, { steps: 3 })).toBeCloseTo(-2.4, 5);
  });

  it('returns the current offset when the price is unusable', () => {
    expect(applyScrollOffset(12, 1, 0)).toBe(12);
    expect(applyScrollOffset(12, 1, null)).toBe(12);
  });

  it('never leaves the clamp range', () => {
    expect(applyScrollOffset(0, -1, 2500, { steps: 1000 })).toBe(MIN_OFFSET);
    expect(applyScrollOffset(0, 1, 2500, { steps: 100000 })).toBe(MAX_OFFSET);
  });
});

describe('getEffectivePrice', () => {
  it('returns the real price when there is no offset', () => {
    expect(getEffectivePrice(2500, 0)).toBe(2500);
    expect(getEffectivePrice(2500, undefined)).toBe(2500);
  });

  it('applies the percentage offset', () => {
    expect(getEffectivePrice(2500, 20)).toBe(3000);
    expect(getEffectivePrice(2500, -50)).toBe(1250);
  });

  it('keeps the offset relative when the real price refreshes', () => {
    expect(getEffectivePrice(2600, 20)).toBe(3120);
  });

  it('returns null for unusable real prices', () => {
    expect(getEffectivePrice(0, 20)).toBeNull();
    expect(getEffectivePrice(null, 20)).toBeNull();
  });

  it('avoids floating point noise', () => {
    expect(getEffectivePrice(0.1, 20)).toBe(0.12);
  });
});

describe('computeSnapshot', () => {
  const portfolio = { BTC: 0.5, ETH: 2 };
  const precios = {
    BTC: { price: 60000, change24h: 1 },
    ETH: { price: 2500, change24h: -1 }
  };

  it('mirrors the real values when nothing is simulated', () => {
    const snapshot = computeSnapshot(portfolio, precios, {});

    expect(snapshot.porActivo.ETH).toEqual({
      amount: 2,
      realPrice: 2500,
      price: 2500,
      offset: 0,
      isSimulated: false,
      value: 5000,
      realValue: 5000,
      delta: 0
    });
    expect(snapshot.total).toBe(35000);
    expect(snapshot.realTotal).toBe(35000);
    expect(snapshot.totalDelta).toBe(0);
    expect(snapshot.totalDeltaPct).toBe(0);
    expect(snapshot.hasSim).toBe(false);
    expect(snapshot.simulatedSymbols).toEqual([]);
  });

  it('recalculates the partial and the total amount with the simulated price', () => {
    const snapshot = computeSnapshot(portfolio, precios, { ETH: 20 });

    expect(snapshot.porActivo.ETH.value).toBe(6000);
    expect(snapshot.porActivo.ETH.realValue).toBe(5000);
    expect(snapshot.porActivo.ETH.delta).toBe(1000);
    expect(snapshot.porActivo.BTC.isSimulated).toBe(false);
    expect(snapshot.total).toBe(36000);
    expect(snapshot.realTotal).toBe(35000);
    expect(snapshot.totalDelta).toBe(1000);
    expect(snapshot.totalDeltaPct).toBeCloseTo(2.857142857, 5);
    expect(snapshot.hasSim).toBe(true);
    expect(snapshot.simulatedSymbols).toEqual(['ETH']);
  });

  it('keeps working when the real price refreshes under an active offset', () => {
    const refreshed = { BTC: { price: 61000 }, ETH: { price: 2600 } };
    const snapshot = computeSnapshot(portfolio, refreshed, { ETH: 20 });

    expect(snapshot.porActivo.ETH.price).toBe(3120);
    expect(snapshot.total).toBe(36740);
  });

  it('simulates several assets at the same time', () => {
    const snapshot = computeSnapshot(portfolio, precios, { BTC: 20, ETH: -35 });

    expect(snapshot.porActivo.BTC.isSimulated).toBe(true);
    expect(snapshot.porActivo.BTC.price).toBe(72000);
    expect(snapshot.porActivo.BTC.value).toBe(36000);
    expect(snapshot.porActivo.BTC.delta).toBe(6000);

    expect(snapshot.porActivo.ETH.isSimulated).toBe(true);
    expect(snapshot.porActivo.ETH.value).toBeCloseTo(3250, 6);
    expect(snapshot.porActivo.ETH.delta).toBeCloseTo(-1750, 6);

    expect(snapshot.total).toBeCloseTo(39250, 6);
    expect(snapshot.realTotal).toBeCloseTo(35000, 6);
    expect(snapshot.totalDelta).toBeCloseTo(4250, 6);
    expect(snapshot.totalDeltaPct).toBeCloseTo(12.1428, 3);
    expect(snapshot.simulatedSymbols).toEqual(['BTC', 'ETH']);
  });

  it('keeps the offsets of each asset when the real prices refresh', () => {
    const refreshed = { BTC: { price: 61000 }, ETH: { price: 2600 } };
    const snapshot = computeSnapshot(portfolio, refreshed, { BTC: 20, ETH: -35 });

    expect(snapshot.porActivo.BTC.offset).toBe(20);
    expect(snapshot.porActivo.ETH.offset).toBe(-35);
    expect(snapshot.porActivo.BTC.value).toBeCloseTo(36600, 6);
    expect(snapshot.porActivo.ETH.value).toBeCloseTo(3380, 6);
  });

  it('treats a zero offset as not simulated', () => {
    const snapshot = computeSnapshot(portfolio, precios, { ETH: 0 });

    expect(snapshot.porActivo.ETH.isSimulated).toBe(false);
    expect(snapshot.hasSim).toBe(false);
  });

  it('ignores invalid offsets', () => {
    const snapshot = computeSnapshot(portfolio, precios, { ETH: NaN, BTC: '10' });

    expect(snapshot.porActivo.ETH.offset).toBe(0);
    expect(snapshot.porActivo.BTC.offset).toBe(0);
    expect(snapshot.hasSim).toBe(false);
  });

  it('values assets without price as zero without breaking the total', () => {
    const snapshot = computeSnapshot({ ZEC: 3, ETH: 2 }, { ETH: { price: 2500 } }, { ZEC: 50 });

    expect(snapshot.porActivo.ZEC).toEqual({
      amount: 3,
      realPrice: null,
      price: null,
      offset: 0,
      isSimulated: false,
      value: 0,
      realValue: 0,
      delta: 0
    });
    expect(snapshot.total).toBe(5000);
  });

  it('handles an empty portfolio', () => {
    const snapshot = computeSnapshot({}, precios, {});

    expect(snapshot.total).toBe(0);
    expect(snapshot.hasSim).toBe(false);
  });

  it('handles missing arguments', () => {
    const snapshot = computeSnapshot();

    expect(snapshot.total).toBe(0);
    expect(snapshot.porActivo).toEqual({});
  });

  it('computes a negative total delta when the price goes down', () => {
    const snapshot = computeSnapshot(portfolio, precios, { ETH: -50 });

    expect(snapshot.total).toBe(32500);
    expect(snapshot.totalDelta).toBe(-2500);
    expect(snapshot.totalDeltaPct).toBeCloseTo(-7.142857143, 5);
  });
});

describe('formatPrice', () => {
  it('uses two decimals for values over one dollar', () => {
    expect(formatPrice(2500.3172)).toBe('2500.32');
    expect(formatPrice(60000)).toBe('60000.00');
  });

  it('increases precision for low priced assets', () => {
    expect(formatPrice(0.35412)).toBe('0.3541');
    expect(formatPrice(0.0041)).toBe('0.004100');
  });

  it('returns null for unusable values', () => {
    expect(formatPrice(0)).toBeNull();
    expect(formatPrice(null)).toBeNull();
  });
});

describe('formatUsd', () => {
  it('keeps one decimal under a thousand and rounds above it', () => {
    expect(formatUsd(999.44)).toBe('999.4');
    expect(formatUsd(1234.5)).toBe('1235');
  });

  it('adds an explicit sign when requested', () => {
    expect(formatUsd(123.4, { signed: true })).toBe('+123.4');
    expect(formatUsd(-123.4, { signed: true })).toBe('-123.4');
    expect(formatUsd(123.4)).toBe('123.4');
    expect(formatUsd(0, { signed: true })).toBe('0.0');
  });

  it('falls back to 0 for unusable values', () => {
    expect(formatUsd(NaN)).toBe('0');
    expect(formatUsd(undefined)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('signs positive values by default', () => {
    expect(formatPercent(12.53)).toBe('+12.5%');
    expect(formatPercent(-8)).toBe('-8.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('can render without sign', () => {
    expect(formatPercent(4.21, { signed: false })).toBe('4.2%');
  });
});
