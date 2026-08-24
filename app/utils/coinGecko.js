export const KNOWN_SYMBOL_TO_ID = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'LTC': 'litecoin'
};

export function resolveUnknownSymbols(symbols, knownMap, cachedMappings) {
  return symbols.filter(
    s => !knownMap[s] && !cachedMappings[s]
  );
}

export async function searchCoinGeckoIds(unknownSymbols, fetchFn = fetch) {
  const newMappings = {};
  await Promise.all(unknownSymbols.map(async (symbol) => {
    try {
      const searchResponse = await fetchFn(
        `https://api.coingecko.com/api/v3/search?query=${symbol}`
      );
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.coins && searchData.coins.length > 0) {
          newMappings[symbol] = searchData.coins[0].id;
        }
      }
    } catch (e) {
      // Ignore search errors
    }
  }));
  return newMappings;
}

export function buildSymbolToIdMap(allSymbols, knownMap, cachedMappings, newMappings) {
  const symbolToId = { ...knownMap, ...cachedMappings, ...newMappings };
  const resolved = {};
  const unresolved = [];

  allSymbols.forEach(symbol => {
    if (symbolToId[symbol]) {
      resolved[symbol] = symbolToId[symbol];
    } else {
      unresolved.push(symbol);
    }
  });

  return { resolved, unresolved };
}

export async function fetchPricesByIds(ids, fetchFn = fetch) {
  if (!ids || ids.length === 0) return {};

  const idsParam = ids.join(',');
  const response = await fetchFn(
    `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true`
  );

  if (!response.ok) {
    return {};
  }

  const data = await response.json();
  if (!data || typeof data !== 'object') {
    return {};
  }

  return data;
}

export function formatPrices(allSymbols, symbolToId, apiData) {
  const preciosFormateados = {};
  allSymbols.forEach(symbol => {
    const id = symbolToId[symbol];
    if (id && apiData[id] && apiData[id].usd !== undefined) {
      preciosFormateados[symbol] = {
        price: apiData[id].usd,
        change24h: apiData[id].usd_24h_change
      };
    }
  });
  return preciosFormateados;
}

export async function resolveAndFetchPrecios(allSymbols, {
  fetchFn = fetch,
  getCachedMappings = () => ({}),
  saveCachedMappings = () => {},
} = {}) {
  const cachedMappings = getCachedMappings();

  const unknownSymbols = resolveUnknownSymbols(allSymbols, KNOWN_SYMBOL_TO_ID, cachedMappings);

  const newMappings = await searchCoinGeckoIds(unknownSymbols, fetchFn);

  if (Object.keys(newMappings).length > 0) {
    const updatedCache = { ...cachedMappings, ...newMappings };
    saveCachedMappings(updatedCache);
  }

  const { resolved: symbolToId } = buildSymbolToIdMap(
    allSymbols, KNOWN_SYMBOL_TO_ID, cachedMappings, newMappings
  );

  const ids = Object.values(symbolToId);
  if (ids.length === 0) return {};

  const apiData = await fetchPricesByIds(ids, fetchFn);
  return formatPrices(allSymbols, symbolToId, apiData);
}
