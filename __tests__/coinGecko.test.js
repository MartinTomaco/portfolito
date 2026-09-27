import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  KNOWN_SYMBOL_TO_ID,
  resolveUnknownSymbols,
  isResolvableSymbol,
  searchCoinGeckoIds,
  buildSymbolToIdMap,
  fetchPricesByIds,
  formatPrices,
  resolveAndFetchPrecios,
  readPriceCache,
  writePriceCache,
  shouldRefetchOnMount,
  PRECIOS_CACHE_KEY,
  PRECIO_REFRESH_MS,
  PRECIO_RECACHE_MS
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

// fakeStorage con la misma interfaz que se le pasa a los helpers: alcanza con
// getItem/setItem.
function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = value; }
  };
}

describe('writePriceCache / readPriceCache', () => {
  const precios = { BTC: { price: 40000, change24h: 1.5 } };

  it('round-trips the prices it just wrote', () => {
    const storage = fakeStorage();
    const now = 1_000_000;

    writePriceCache(precios, storage, now);
    const result = readPriceCache(storage, now);

    expect(result).toEqual({ timestamp: now, precios, age: 0 });
  });

  it('stores under the shared cache key', () => {
    const storage = fakeStorage();
    writePriceCache(precios, storage, 0);
    expect(storage.store[PRECIOS_CACHE_KEY]).toBeDefined();
  });

  it('returns the cache while it is fresh', () => {
    const storage = fakeStorage();
    writePriceCache(precios, storage, 0);

    const justUnder = readPriceCache(storage, PRECIO_REFRESH_MS - 1);
    expect(justUnder).not.toBeNull();
    expect(justUnder.precios).toEqual(precios);
    expect(justUnder.age).toBe(PRECIO_REFRESH_MS - 1);
  });

  it('returns null once the cache is older than the refresh window', () => {
    const storage = fakeStorage();
    writePriceCache(precios, storage, 0);

    expect(readPriceCache(storage, PRECIO_REFRESH_MS)).toBeNull();
    expect(readPriceCache(storage, PRECIO_REFRESH_MS + 1)).toBeNull();
  });

  it('returns null when there is no cache at all', () => {
    expect(readPriceCache(fakeStorage(), 0)).toBeNull();
  });

  it('returns null on unparseable JSON instead of throwing', () => {
    const storage = fakeStorage({ [PRECIOS_CACHE_KEY]: '{{{no json' });
    expect(readPriceCache(storage, 0)).toBeNull();
  });

  it('rejects a cache that is missing its fields', () => {
    const noTimestamp = fakeStorage({ [PRECIOS_CACHE_KEY]: JSON.stringify({ precios }) });
    const noPrecios = fakeStorage({ [PRECIOS_CACHE_KEY]: JSON.stringify({ timestamp: 0 }) });
    const badTypes = fakeStorage({
      [PRECIOS_CACHE_KEY]: JSON.stringify({ timestamp: 'ayer', precios })
    });

    expect(readPriceCache(noTimestamp, 0)).toBeNull();
    expect(readPriceCache(noPrecios, 0)).toBeNull();
    expect(readPriceCache(badTypes, 0)).toBeNull();
  });

  it('rejects a cache stamped in the future (reloj movido)', () => {
    const storage = fakeStorage();
    writePriceCache(precios, storage, 10_000);
    expect(readPriceCache(storage, 0)).toBeNull();
  });

  it('survives a storage that throws on getItem', () => {
    const broken = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); }
    };

    expect(readPriceCache(broken, 0)).toBeNull();
    expect(() => writePriceCache(precios, broken, 0)).not.toThrow();
  });
});

describe('isResolvableSymbol', () => {
  it('resolves symbols from the known map without a network call', () => {
    expect(isResolvableSymbol('BTC')).toBe(true);
    expect(isResolvableSymbol('ETH')).toBe(true);
    expect(isResolvableSymbol('XRP')).toBe(true);
  });

  it('resolves symbols that were cached from an earlier search', () => {
    expect(isResolvableSymbol('WEIRD', { WEIRD: 'weird-coin' })).toBe(true);
  });

  it('does not resolve unknown symbols', () => {
    expect(isResolvableSymbol('NOPE')).toBe(false);
    expect(isResolvableSymbol('NOPE', { OTHER: 'x' })).toBe(false);
  });

  it('defaults the cache to empty', () => {
    expect(isResolvableSymbol('NOPE')).toBe(false);
  });
});

describe('shouldRefetchOnMount', () => {
  it('refetches when there is no cache at all', () => {
    expect(shouldRefetchOnMount(null)).toBe(true);
    expect(shouldRefetchOnMount(undefined)).toBe(true);
  });

  it('refetches when the cache is younger than a minute', () => {
    expect(shouldRefetchOnMount({ age: 0 })).toBe(true);
    expect(shouldRefetchOnMount({ age: 30_000 })).toBe(true);
    expect(shouldRefetchOnMount({ age: PRECIO_RECACHE_MS - 1 })).toBe(true);
  });

  it('trusts the cache from one minute up to the refresh window', () => {
    expect(shouldRefetchOnMount({ age: PRECIO_RECACHE_MS })).toBe(false);
    expect(shouldRefetchOnMount({ age: 90_000 })).toBe(false);
    expect(shouldRefetchOnMount({ age: PRECIO_REFRESH_MS - 1 })).toBe(false);
  });

  it('keeps the recache window inside the cache validity window', () => {
    expect(PRECIO_RECACHE_MS).toBeLessThan(PRECIO_REFRESH_MS);
  });

  // Los tiempos salen de las constantes, no de numeros sueltos: asi el test
  // sigue siendo valido si se cambia PRECIO_REFRESH_MS o PRECIO_RECACHE_MS.
  it('agrees with readPriceCache: a fresh cache still refetches', () => {
    const storage = fakeStorage();
    writePriceCache({ BTC: { price: 1, change24h: 0 } }, storage, 0);

    // Todavia joven (< ventana de recache): el cache vale, pero igual refresca.
    const fresh = readPriceCache(storage, PRECIO_RECACHE_MS - 1);
    expect(fresh).not.toBeNull();
    expect(shouldRefetchOnMount(fresh)).toBe(true);

    // Ya paso la ventana de recache pero sigue dentro de la vigencia: alcanza
    // con lo guardado.
    const older = readPriceCache(storage, PRECIO_RECACHE_MS + 1);
    expect(older).not.toBeNull();
    expect(older.age).toBe(PRECIO_RECACHE_MS + 1);
    expect(shouldRefetchOnMount(older)).toBe(false);

    // Cache vencido: readPriceCache devuelve null y se consulta.
    const expired = readPriceCache(storage, PRECIO_REFRESH_MS);
    expect(expired).toBeNull();
    expect(shouldRefetchOnMount(expired)).toBe(true);
  });
});
