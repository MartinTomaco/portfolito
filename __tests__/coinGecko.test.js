import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  KNOWN_SYMBOL_TO_ID,
  resolveUnknownSymbols,
  searchCoinGeckoIds,
  buildSymbolToIdMap,
  fetchPricesByIds,
  formatPrices,
  resolveAndFetchPrecios
} from '../app/utils/coinGecko.js';

describe('resolveUnknownSymbols', () => {
  const knownMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum' };

  it('returns empty array when all symbols are known', () => {
    const result = resolveUnknownSymbols(['BTC', 'ETH'], knownMap, {});
    expect(result).toEqual([]);
  });

  it('returns symbols not in known map or cache', () => {
    const result = resolveUnknownSymbols(['BTC', 'ZEC', 'DOGE'], knownMap, {});
    expect(result).toEqual(['ZEC', 'DOGE']);
  });

  it('skips symbols that are in cache', () => {
    const cache = { 'ZEC': 'zcash' };
    const result = resolveUnknownSymbols(['BTC', 'ZEC', 'DOGE'], knownMap, cache);
    expect(result).toEqual(['DOGE']);
  });

  it('handles empty input', () => {
    const result = resolveUnknownSymbols([], knownMap, {});
    expect(result).toEqual([]);
  });
});

describe('searchCoinGeckoIds', () => {
  it('resolves symbols to CoinGecko IDs via search API', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          coins: [{ id: 'zcash', symbol: 'zec' }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          coins: [{ id: 'dogecoin', symbol: 'doge' }]
        })
      });

    const result = await searchCoinGeckoIds(['ZEC', 'DOGE'], mockFetch);
    expect(result).toEqual({ 'ZEC': 'zcash', 'DOGE': 'dogecoin' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips symbols that return no results', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ coins: [] })
    });

    const result = await searchCoinGeckoIds(['FAKECOIN'], mockFetch);
    expect(result).toEqual({});
  });

  it('skips symbols with failed API calls', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });

    const result = await searchCoinGeckoIds(['ZEC'], mockFetch);
    expect(result).toEqual({});
  });

  it('skips symbols with network errors', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await searchCoinGeckoIds(['ZEC'], mockFetch);
    expect(result).toEqual({});
  });

  it('returns empty object for empty input', async () => {
    const result = await searchCoinGeckoIds([], jest.fn());
    expect(result).toEqual({});
  });
});

describe('buildSymbolToIdMap', () => {
  const knownMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum' };

  it('resolves all symbols from known map', () => {
    const { resolved, unresolved } = buildSymbolToIdMap(
      ['BTC', 'ETH'], knownMap, {}, {}
    );
    expect(resolved).toEqual({ 'BTC': 'bitcoin', 'ETH': 'ethereum' });
    expect(unresolved).toEqual([]);
  });

  it('resolves symbols from cache', () => {
    const cache = { 'ZEC': 'zcash' };
    const { resolved, unresolved } = buildSymbolToIdMap(
      ['BTC', 'ZEC'], knownMap, cache, {}
    );
    expect(resolved).toEqual({ 'BTC': 'bitcoin', 'ZEC': 'zcash' });
    expect(unresolved).toEqual([]);
  });

  it('resolves symbols from new mappings', () => {
    const newMappings = { 'DOGE': 'dogecoin' };
    const { resolved, unresolved } = buildSymbolToIdMap(
      ['BTC', 'DOGE'], knownMap, {}, newMappings
    );
    expect(resolved).toEqual({ 'BTC': 'bitcoin', 'DOGE': 'dogecoin' });
    expect(unresolved).toEqual([]);
  });

  it('marks symbols as unresolved when not found anywhere', () => {
    const { resolved, unresolved } = buildSymbolToIdMap(
      ['BTC', 'UNKNOWN'], knownMap, {}, {}
    );
    expect(resolved).toEqual({ 'BTC': 'bitcoin' });
    expect(unresolved).toEqual(['UNKNOWN']);
  });

  it('prioritizes newMappings over cache over knownMap', () => {
    const knownMapOverride = { 'BTC': 'bitcoin-old' };
    const cache = { 'BTC': 'bitcoin-cache' };
    const newMappings = { 'BTC': 'bitcoin-new' };
    const { resolved } = buildSymbolToIdMap(
      ['BTC'], knownMapOverride, cache, newMappings
    );
    expect(resolved).toEqual({ 'BTC': 'bitcoin-new' });
  });
});

describe('fetchPricesByIds', () => {
  it('fetches prices for given IDs', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 60000, usd_24h_change: 2.5 },
        ethereum: { usd: 3000, usd_24h_change: -1.2 }
      })
    });

    const result = await fetchPricesByIds(['bitcoin', 'ethereum'], mockFetch);
    expect(result).toEqual({
      bitcoin: { usd: 60000, usd_24h_change: 2.5 },
      ethereum: { usd: 3000, usd_24h_change: -1.2 }
    });
  });

  it('returns empty object for empty IDs', async () => {
    const result = await fetchPricesByIds([], jest.fn());
    expect(result).toEqual({});
  });

  it('returns empty object for null/undefined IDs', async () => {
    expect(await fetchPricesByIds(null, jest.fn())).toEqual({});
    expect(await fetchPricesByIds(undefined, jest.fn())).toEqual({});
  });

  it('returns empty object when API fails', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchPricesByIds(['bitcoin'], mockFetch);
    expect(result).toEqual({});
  });

  it('returns empty object when response is invalid JSON', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => 'not-an-object'
    });
    const result = await fetchPricesByIds(['bitcoin'], mockFetch);
    expect(result).toEqual({});
  });
});

describe('formatPrices', () => {
  const symbolToId = { 'BTC': 'bitcoin', 'ZEC': 'zcash' };

  it('formats API data into price objects', () => {
    const apiData = {
      bitcoin: { usd: 60000, usd_24h_change: 2.5 },
      zcash: { usd: 200, usd_24h_change: -0.5 }
    };
    const result = formatPrices(['BTC', 'ZEC'], symbolToId, apiData);
    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 },
      'ZEC': { price: 200, change24h: -0.5 }
    });
  });

  it('skips symbols without data in API response', () => {
    const apiData = {
      bitcoin: { usd: 60000, usd_24h_change: 2.5 }
    };
    const result = formatPrices(['BTC', 'ZEC'], symbolToId, apiData);
    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 }
    });
  });

  it('skips symbols without coinGecko ID', () => {
    const apiData = {
      bitcoin: { usd: 60000, usd_24h_change: 2.5 }
    };
    const result = formatPrices(['BTC', 'UNKNOWN'], symbolToId, apiData);
    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 }
    });
  });

  it('returns empty object for empty input', () => {
    const result = formatPrices([], symbolToId, {});
    expect(result).toEqual({});
  });
});

describe('resolveAndFetchPrecios', () => {
  it('resolves known symbols directly without search API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 60000, usd_24h_change: 2.5 },
        ethereum: { usd: 3000, usd_24h_change: -1.0 }
      })
    });

    const result = await resolveAndFetchPrecios(['BTC', 'ETH'], {
      fetchFn: mockFetch,
      getCachedMappings: () => ({}),
      saveCachedMappings: jest.fn(),
    });

    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 },
      'ETH': { price: 3000, change24h: -1.0 }
    });
    // Only 1 call to /simple/price (no /search calls needed)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.coingecko.com/api/v3/simple/price')
    );
  });

  it('resolves unknown symbols via search API', async () => {
    const searchCallCount = { count: 0 };
    const mockFetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('/search?query=ZEC')) {
        searchCallCount.count++;
        return {
          ok: true,
          json: async () => ({ coins: [{ id: 'zcash', symbol: 'zec' }] })
        };
      }
      if (url.includes('/simple/price')) {
        return {
          ok: true,
          json: async () => ({
            bitcoin: { usd: 60000, usd_24h_change: 2.5 },
            zcash: { usd: 200, usd_24h_change: -0.5 }
          })
        };
      }
      return { ok: false };
    });

    const saveCache = jest.fn();

    const result = await resolveAndFetchPrecios(['BTC', 'ZEC'], {
      fetchFn: mockFetch,
      getCachedMappings: () => ({}),
      saveCachedMappings: saveCache,
    });

    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 },
      'ZEC': { price: 200, change24h: -0.5 }
    });
    // /search was called for ZEC
    expect(searchCallCount.count).toBe(1);
    // Cache was saved with ZEC mapping
    expect(saveCache).toHaveBeenCalledWith({ 'ZEC': 'zcash' });
  });

  it('uses cached mappings without calling search API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 60000, usd_24h_change: 2.5 },
        zcash: { usd: 200, usd_24h_change: -0.5 }
      })
    });

    const result = await resolveAndFetchPrecios(['BTC', 'ZEC'], {
      fetchFn: mockFetch,
      getCachedMappings: () => ({ 'ZEC': 'zcash' }),
      saveCachedMappings: jest.fn(),
    });

    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 },
      'ZEC': { price: 200, change24h: -0.5 }
    });
    // Only 1 call to /simple/price, no /search calls
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles mixed known, cached, and unknown symbols', async () => {
    const mockFetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('/search?query=DOGE')) {
        return {
          ok: true,
          json: async () => ({ coins: [{ id: 'dogecoin', symbol: 'doge' }] })
        };
      }
      if (url.includes('/simple/price')) {
        return {
          ok: true,
          json: async () => ({
            bitcoin: { usd: 60000, usd_24h_change: 2.5 },
            zcash: { usd: 200, usd_24h_change: -0.5 },
            dogecoin: { usd: 0.15, usd_24h_change: 5.0 }
          })
        };
      }
      return { ok: false };
    });

    const saveCache = jest.fn();

    const result = await resolveAndFetchPrecios(['BTC', 'ZEC', 'DOGE'], {
      fetchFn: mockFetch,
      getCachedMappings: () => ({ 'ZEC': 'zcash' }),
      saveCachedMappings: saveCache,
    });

    expect(result).toEqual({
      'BTC': { price: 60000, change24h: 2.5 },
      'ZEC': { price: 200, change24h: -0.5 },
      'DOGE': { price: 0.15, change24h: 5.0 }
    });
    // /search only for DOGE (ZEC was cached)
    expect(saveCache).toHaveBeenCalledWith({ 'ZEC': 'zcash', 'DOGE': 'dogecoin' });
  });

  it('returns empty object when no symbols can be resolved', async () => {
    const mockFetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('/search')) {
        return { ok: true, json: async () => ({ coins: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const result = await resolveAndFetchPrecios(['UNKNOWN'], {
      fetchFn: mockFetch,
      getCachedMappings: () => ({}),
      saveCachedMappings: jest.fn(),
    });

    expect(result).toEqual({});
  });

  it('does not save cache when no new mappings found', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 60000, usd_24h_change: 2.5 }
      })
    });

    const saveCache = jest.fn();

    await resolveAndFetchPrecios(['BTC'], {
      fetchFn: mockFetch,
      getCachedMappings: () => ({}),
      saveCachedMappings: saveCache,
    });

    expect(saveCache).not.toHaveBeenCalled();
  });
});
