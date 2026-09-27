'use client'
import { useState, useEffect } from 'react';
import CryptoMarquee from "./components/CryptoMarquee";
import CryptoPortfolio from "./components/CryptoPortfolio";
import LoginModal from "./components/LoginModal";
import { resolveAndFetchPrecios } from "./utils/coinGecko";

const GUEST_SESSION = { isGuest: true };

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
    const fetchPrecios = async () => {
      try {
        const storedPortfolio = localStorage.getItem('cryptoPortfolio');
        const portfolioSymbols = storedPortfolio ? Object.keys(JSON.parse(storedPortfolio)) : [];
        const defaultSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
        const allSymbols = [...new Set([...defaultSymbols, ...portfolioSymbols])];

        const preciosFormateados = await resolveAndFetchPrecios(allSymbols, {
          getCachedMappings: () => JSON.parse(localStorage.getItem('symbolToIdCache') || '{}'),
          saveCachedMappings: (cache) => localStorage.setItem('symbolToIdCache', JSON.stringify(cache)),
        });

        setPrecios(prevPrecios => ({ ...prevPrecios, ...preciosFormateados }));
      } catch (error) {
        console.warn('Error al obtener precios:', error.message);
      }
    };

    fetchPrecios();
    const interval = setInterval(fetchPrecios, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <CryptoMarquee precios={precios} />
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
