// Tests del proxy /api/precios. El fetch global esta mockeado, asi que estos
// no dependen de que CoinGecko este disponible: prueban el cableado, los
// headers, la key y el cache.

const PRECIOS_BODY = {
  bitcoin: { usd: 60000, usd_24h_change: 2.5 },
  ethereum: { usd: 3000, usd_24h_change: -1 }
};

// Cada test necesita el modulo fresco: la key se lee al cargar y el cache vive
// en el scope del modulo.
function loadRoute(apiKey) {
  let mod;
  jest.isolateModules(() => {
    if (apiKey === undefined) delete process.env.COINGECKO_API_KEY;
    else process.env.COINGECKO_API_KEY = apiKey;
    mod = require('../app/api/precios/route.js');
  });
  return mod;
}

const call = (mod, qs) => mod.GET({ url: `http://localhost:3000/api/precios?${qs}` });

const okResponse = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => body,
});

const errResponse = (status, retryAfter = null) => ({
  ok: false,
  status,
  headers: { get: (h) => (h === 'retry-after' ? retryAfter : null) },
  json: async () => ({}),
});

afterEach(() => {
  delete process.env.COINGECKO_API_KEY;
  jest.restoreAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('GET /api/precios', () => {
  it('returns the prices untouched from the batch request', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse(PRECIOS_BODY));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=bitcoin,ethereum');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(PRECIOS_BODY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/simple/price?ids=bitcoin,ethereum');
    expect(fetchMock.mock.calls[0][0]).toContain('include_24hr_change=true');
  });

  it('sends the demo API key when COINGECKO_API_KEY is set', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse(PRECIOS_BODY));
    global.fetch = fetchMock;

    const { GET } = loadRoute('CG-key-real');
    const res = await call({ GET }, 'ids=bitcoin');

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['x-cg-demo-api-key']).toBe('CG-key-real');
    expect(res.headers.get('x-hay-key')).toBe('si');
  });

  it('omits the key header when the env var is missing, and says so', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse(PRECIOS_BODY));
    global.fetch = fetchMock;

    const { GET } = loadRoute(undefined);
    const res = await call({ GET }, 'ids=bitcoin');

    expect(fetchMock.mock.calls[0][1].headers['x-cg-demo-api-key']).toBeUndefined();
    // Esto es lo que permite detectar la key faltante desde el navegador.
    expect(res.headers.get('x-hay-key')).toBe('no');
  });

  // El 403 es lo que rompia produccion. Lo que importa es que la respuesta siga
  // siendo 200 parseable y que el motivo quede a la vista.
  it('answers 200 with an empty body and the reason when upstream 403s', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(403));

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=bitcoin');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({});
    expect(res.headers.get('x-upstream')).toBe('HTTP 403');
  });

  it('does not retry on 403, only on 429', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errResponse(403));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    await call({ GET }, 'ids=bitcoin');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on 429 honoring Retry-After', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(errResponse(429, '1'))
      .mockResolvedValueOnce(okResponse(PRECIOS_BODY));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=bitcoin');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.headers.get('x-upstream')).toBe('ok');
  });

  // La keyless pool manda Retry-After de hasta ~50s. Reintentar a los 3s solo
  // compra otro 429, asi que con un wait largo se abandona y se deja que la
  // cache sirva lo viejo.
  it('gives up on 429 when Retry-After is long instead of hammering', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errResponse(429, '50'));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=bitcoin');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get('x-upstream')).toBe('HTTP 429');
  });

  it('serves stale prices when the refresh after the TTL fails', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(okResponse(PRECIOS_BODY));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    const t0 = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(t0);

    await (await call({ GET }, 'ids=bitcoin')).json();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Dentro de la ventana de cache ni vuelve a pegarle a CoinGecko.
    nowSpy.mockReturnValue(t0 + 30_000);
    const second = await call({ GET }, 'ids=bitcoin');
    await expect(second.json()).resolves.toEqual(PRECIOS_BODY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.headers.get('x-upstream')).toBe('hit');

    // Ventana vencida y CoinGecko caido: se sirve igual lo viejo, en vez de
    // devolver {} y dejar la tabla entera en "Sin precio".
    nowSpy.mockReturnValue(t0 + 90_000);
    fetchMock.mockResolvedValueOnce(errResponse(500));
    const third = await call({ GET }, 'ids=bitcoin');

    await expect(third.json()).resolves.toEqual(PRECIOS_BODY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(third.headers.get('x-upstream')).toBe('HTTP 500');
  });

  it('has nothing to serve when the very first call fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(403));

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=bitcoin');

    // Sin cache previa no hay magia posible: {} y el motivo.
    await expect(res.json()).resolves.toEqual({});
    expect(res.headers.get('x-upstream')).toBe('HTTP 403');
  });

  it('does not mix prices between two different sets of ids', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(okResponse({ bitcoin: { usd: 1, usd_24h_change: 0 } }))
      .mockResolvedValueOnce(okResponse({ dogecoin: { usd: 2, usd_24h_change: 0 } }));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    await (await call({ GET }, 'ids=bitcoin')).json();
    const other = await call({ GET }, 'ids=dogecoin');

    // Misma cantidad de ids, distinta cartera: la clave del cache tiene que
    // distinguirla, si no se sirven precios de otra cripto.
    await expect(other.json()).resolves.toEqual({ dogecoin: { usd: 2, usd_24h_change: 0 } });
  });

  it('resolves a search into a flat symbol to id map', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse({
      coins: [{ id: 'zcash', symbol: 'zec' }]
    }));
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    const res = await call({ GET }, 'a=search&s=ZEC');

    await expect(res.json()).resolves.toEqual({ ZEC: 'zcash' });
    expect(fetchMock.mock.calls[0][0]).toContain('/search?query=ZEC');
  });

  it('leaves out symbols the search does not know', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse({ coins: [] }));

    const { GET } = loadRoute();
    const res = await call({ GET }, 'a=search&s=FAKECOIN');

    await expect(res.json()).resolves.toEqual({});
  });

  it('never calls CoinGecko without ids', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({});
  });

  it('survives a fetch that rejects outright', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const { GET } = loadRoute();
    const res = await call({ GET }, 'ids=bitcoin');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({});
    expect(res.headers.get('x-upstream')).toBe('sin respuesta');
  });
});
