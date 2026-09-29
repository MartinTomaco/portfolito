import { NextResponse } from 'next/server';

const COINGECKO = 'https://api.coingecko.com/api/v3';
const API_KEY = process.env.COINGECKO_API_KEY;

// El 403 que se veia en produccion no era CORS: el WAF de CloudFront bloquea
// los requests que parecen venir de un browser, y la app pegaba directo a
// CoinGecko desde el cliente. Ahora la llamada sale de aca, sin Origin, y
// pasa. Lo que queda es el 429 por limite de la IP compartida, que se
// resuelve con una key.
const authHeaders = () => {
  const headers = { 'accept': 'application/json' };
  if (API_KEY) headers['x-cg-demo-api-key'] = API_KEY;
  return headers;
};

// Cuanto se aguanta la respuesta antes de pegarle a CoinGecko. El cache es
// global del server, no por navegador: en vez de un fetch por usuario cada
// 90s, es UN fetch para todos los que abran la app dentro de la ventana.
const EDGE_TTL_MS = 60 * 1000;

const cache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Contra un 429 se espera lo que diga Retry-After, pero solo se reintenta si
// el wait es corto. La keyless pool llega a mandar Retry-After de ~50s:
// reintentar a los 3s solo consigue otro 429 y, segun la doc, lo que agrava el
// limite es justamente insistir. Si el wait es largo se devuelve el 429 y la
// capa de cache sirve el precio viejo; el proximo poll reintenta solo.
const MAX_RETRY_WAIT_MS = 5000;

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
    } catch {
      if (attempt === 0) { await sleep(500); continue; }
      return null;
    }
    if (res.status === 429 && attempt === 0) {
      const raw = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(raw) && raw > 0 ? raw * 1000 : 1000;
      if (waitMs > MAX_RETRY_WAIT_MS) return res;
      await sleep(waitMs);
      continue;
    }
    return res;
  }
  return null;
}

// Cache simple en memoria con TTL. En Vercel cada instancia tiene la suya, asi
// que esto no es un cache global, pero sirve: una instancia tibia absorbe los
// refresh de todos los clientes que le pegan.
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return { data: hit.data, status: 'hit' };

  const res = await loader();
  if (res.data === null) {
    // Falla: si teniamos algo guardado, se sirve viejo antes que nada. Mejor
    // un precio de 2 minutos que la columna entera en "Sin precio".
    console.warn(`[precios] ${key} fallo con ${res.status}; ` +
      `${hit ? 'sirviendo cache vieja' : 'sin datos para entregar'}`);
    return { data: hit ? hit.data : null, status: res.status };
  }
  cache.set(key, { at: now, data: res.data });
  return { data: res.data, status: res.status };
}

async function getPrices(ids) {
  if (!ids.length) return { data: {}, status: 'vacio' };

  const url = `${COINGECKO}/simple/price?ids=${ids.join(',')}` +
    `&vs_currencies=usd&include_24hr_change=true`;

  // La clave es el conjunto de ids exacto, no la cantidad: dos carteras con
  // 5 cryptos distintas NO pueden compartir entrada de cache.
  return cached(`precios:${[...ids].sort().join(',')}`, EDGE_TTL_MS, async () => {
    const res = await fetchWithRetry(url);
    if (!res) return { data: null, status: 'sin respuesta' };
    if (!res.ok) return { data: null, status: `HTTP ${res.status}` };
    try {
      return { data: await res.json(), status: 'ok' };
    } catch {
      return { data: null, status: 'json invalido' };
    }
  });
}

async function searchId(symbol) {
  const url = `${COINGECKO}/search?query=${encodeURIComponent(symbol)}`;

  return cached(`search:${symbol}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetchWithRetry(url);
    if (!res || !res.ok) return { data: null, status: 'search fallo' };
    try {
      const body = await res.json();
      if (!body || !Array.isArray(body.coins) || body.coins.length === 0) {
        return { data: null, status: 'search sin resultados' };
      }
      return { data: { id: body.coins[0].id }, status: 'ok' };
    } catch {
      return { data: null, status: 'json invalido' };
    }
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('a');
  const symbols = (searchParams.get('s') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ids = (searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Con un 200 siempre: si se devuelve 4xx/5xx el browser lo reporta como
  // error de red y el cliente no puede ni distinguishlo de un corte. Ademas el
  // estado real va en un header, que se puede mirar desde el inspector.
  const reply = (data, status) => NextResponse.json(data || {}, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'x-upstream': status || 'ok',
      'x-hay-key': API_KEY ? 'si' : 'no',
    },
  });

  try {
    if (action === 'search') {
      if (!symbols.length) return reply({}, 'vacio');
      const entries = await Promise.all(symbols.map(async (s) => [s, await searchId(s)]));
      const out = {};
      for (const [symbol, found] of entries) {
        if (found.data) out[symbol] = found.data.id;
      }
      return reply(out, 'ok');
    }

    if (!ids.length) return reply({}, 'vacio');

    const { data, status } = await getPrices(ids);
    return reply(data, status);
  } catch (e) {
    console.warn('[precios] excepcion:', e.message);
    return reply({}, 'excepcion');
  }
}
