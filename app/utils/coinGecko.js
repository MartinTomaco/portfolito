// Todo pasa por /api/precios, no directo contra api.coingecko.com. Pegarle a
// CoinGecko desde el browser no funciona: devuelve 403 y, como la respuesta de
// error no trae Access-Control-Allow-Origin, el browser lo reporta como error
// de CORS. No se arregla desde el cliente, porque no se pueden agregar headers a
// la respuesta de otra API. El proxy corre en el server, asi que no hay CORS
// que cumplir y la key, si se agrega, no queda expuesta en el bundle.
export const PRECIOS_ENDPOINT = '/api/precios';

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
  if (!unknownSymbols || unknownSymbols.length === 0) return newMappings;

  // Un solo request con todos los simbolos desconocidos. Antes era uno por
  // simbolo en paralelo, que es la forma mas rapida de comerse un rate limit.
  try {
    const res = await fetchFn(
      `${PRECIOS_ENDPOINT}?a=search&s=${unknownSymbols.map(encodeURIComponent).join(',')}`
    );
    if (!res.ok) return newMappings;
    const data = await res.json();
    if (data && typeof data === 'object') {
      for (const [symbol, id] of Object.entries(data)) {
        if (typeof id === 'string' && id) newMappings[symbol] = id;
      }
    }
  } catch {
    // Si el search falla se sigue igual con lo que ya se sepa resolver: los
    // simbolos desconocidos quedan sin precio en vez de romper todo el batch.
  }
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

export async function fetchPricesByIds(ids, fetchFn = fetch, onMeta = () => {}) {
  if (!ids || ids.length === 0) return {};

  const response = await fetchFn(
    `${PRECIOS_ENDPOINT}?ids=${ids.map(encodeURIComponent).join(',')}`
  );

  // El proxy manda el motivo de una falla en x-upstream y si hay key en
  // x-hay-key. Se lee de esta misma respuesta para poder diagnosticar desde la
  // consola del browser sin pedir nada extra.
  onMeta(
    `upstream=${response.headers?.get?.('x-upstream') || 's/d'} ` +
    `key=${response.headers?.get?.('x-hay-key') || 's/d'}`
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
  onMeta = () => {},
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

  const apiData = await fetchPricesByIds(ids, fetchFn, onMeta);
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
