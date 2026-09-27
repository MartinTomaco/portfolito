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

// Si el símbolo se puede resolver sin pegarle a la API. Sirve para no gastar
// una búsqueda en validar un ticker que ya está en el mapa conocido o en el
// cache: para esos el único fetch que hace falta es el del precio.
export function isResolvableSymbol(symbol, cachedMappings = {}) {
  return Boolean(KNOWN_SYMBOL_TO_ID[symbol] || cachedMappings[symbol]);
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

export const PRECIOS_CACHE_KEY = 'preciosCache';

// Un batch cada 90s. Antes cada 60s y ademas refrescando al abrir la pagina,
// asi que recargar varias veces seguidas quemaba el rate limit de CoinGecko al
// pedo. Este numero es a la vez el intervalo del poll y la vigencia del cache.
export const PRECIO_REFRESH_MS = 90 * 1000;

// Ventana de "recién hecho": si al abrir la pagina el cache tiene menos de
// esto, se refresca igual. El dato es tan reciente que la llamada extra no se
// nota y te abre con el precio más al dia. Entre esta ventana y
// PRECIO_REFRESH_MS se confía en el cache y no se consulta.
export const PRECIO_RECACHE_MS = 60 * 1000;

// true si no hay cache, o si es tan fresco que conviene refrescarlo.
export function shouldRefetchOnMount(cache) {
  if (!cache) return true;
  return cache.age < PRECIO_RECACHE_MS;
}

export function readPriceCache(storage, now = Date.now()) {
  let raw;
  try {
    raw = storage.getItem(PRECIOS_CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Cacheado con otra forma, o de una version vieja: se descarta.
  if (!parsed || typeof parsed !== 'object' || typeof parsed.timestamp !== 'number') {
    return null;
  }
  if (!parsed.precios || typeof parsed.precios !== 'object') return null;

  const age = now - parsed.timestamp;
  if (age < 0 || age >= PRECIO_REFRESH_MS) return null;

  return { timestamp: parsed.timestamp, precios: parsed.precios, age };
}

export function writePriceCache(precios, storage, now = Date.now()) {
  try {
    storage.setItem(PRECIOS_CACHE_KEY, JSON.stringify({ timestamp: now, precios }));
  } catch {
    // localStorage lleno o bloqueado: el cache es una optimizacion, si no
    // entra la app sigue funcionando, solo que consulta mas.
  }
}
