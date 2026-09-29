'use client'
import { useState, useEffect } from 'react';
import CryptoPortfolio from "./components/CryptoPortfolio";
import LoginModal from "./components/LoginModal";
import {
  resolveAndFetchPrecios,
  readPriceCache,
  writePriceCache,
  shouldRefetchOnMount,
  PRECIO_REFRESH_MS
} from "./utils/coinGecko";

const GUEST_SESSION = { isGuest: true };
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];

export default function Home() {
  const [precios, setPrecios] = useState({});
  const [showLogin, setShowLogin] = useState(false);

  // El login es opcional: si no hay sesion guardada se entra directo como
  // invitado y la app queda usable. El modal solo aparece si se pide.
  useEffect(() => {
    let session = null;
    try {
      const savedSession = localStorage.getItem('portfolioSession');
      if (savedSession) session = JSON.parse(savedSession);
    } catch {
      session = null;
    }

    if (session) return;

    localStorage.setItem('portfolioSession', JSON.stringify(GUEST_SESSION));
  }, []);

  const handleLogin = (userData) => {
    setShowLogin(false);
    localStorage.setItem('portfolioSession', JSON.stringify(userData));
  };

  const handleGuestLogin = () => {
    handleLogin(GUEST_SESSION);
  };

  useEffect(() => {
    // 1. Se pinta al instante con el cache y recien ahi se decide si hace
    //    falta pegarle a la API. Sin cache se consulta siempre; con cache
    //    tambien, si el precio tiene menos de un minuto, porque a esa altura
    //    es tan fresco que la llamada extra no se nota y te abre con el
    //    precio mas al dia.
    const cache = readPriceCache(localStorage);
    if (cache) {
      setPrecios(cache.precios);
    }

    let timer = null;

    const fetchPrecios = async () => {
      try {
        const storedPortfolio = localStorage.getItem('cryptoPortfolio');
        const portfolioSymbols = storedPortfolio ? Object.keys(JSON.parse(storedPortfolio)) : [];
        const allSymbols = [...new Set([...DEFAULT_SYMBOLS, ...portfolioSymbols])];

        let upstream = '';
        const preciosFormateados = await resolveAndFetchPrecios(allSymbols, {
          getCachedMappings: () => JSON.parse(localStorage.getItem('symbolToIdCache') || '{}'),
          saveCachedMappings: (cache) => localStorage.setItem('symbolToIdCache', JSON.stringify(cache)),
          // Lee el diagnostico de la MISMA respuesta, sin pedir nada extra.
          onMeta: (meta) => { upstream = meta; },
        });

        // Vacio = el proxy no trajo precios (rate limit, key faltante o caida).
        // Se conservan los que ya teniamos en memoria en vez de dejar las filas
        // a ciegas.
        if (Object.keys(preciosFormateados).length === 0) {
          console.warn(`[precios] sin datos (${upstream || 'motivo desconocido'}). ` +
            'Si dice key=no, falta COINGECKO_API_KEY en Vercel.');
          return;
        }

        setPrecios(prevPrecios => ({ ...prevPrecios, ...preciosFormateados }));
        writePriceCache(preciosFormateados, localStorage);
      } catch (error) {
        console.warn('Error al obtener precios:', error.message);
      }
    };

    const startPolling = () => {
      if (timer !== null) return;
      timer = setInterval(fetchPrecios, PRECIO_REFRESH_MS);
    };

    const stopPolling = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    // 2. Con la pestaña oculta no se consulta: nadie está mirando el número,
    //    y cada poll gastado ahí es un poll que no llega a verse.
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchPrecios();
        startPolling();
      }
    };

    if (shouldRefetchOnMount(cache)) {
      fetchPrecios();
    }
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <div className="flex justify-end p-4">
        <button
          onClick={() => setShowLogin(true)}
          className="text-xs text-[#00ff00]/50 hover:text-[#00ff00] font-mono transition-colors duration-300 flex items-center gap-1"
        >
          ⇥ login
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-start mt-6 sm:mt-10 p-4 md:p-8 w-full">
        <div className="w-full max-w-2xl">
          <CryptoPortfolio precios={precios} setPrecios={setPrecios} />
        </div>
      </div>
      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onGuestLogin={handleGuestLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
