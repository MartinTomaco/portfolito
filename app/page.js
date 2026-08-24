'use client'
import { useState, useEffect } from 'react';
import CryptoMarquee from "./components/CryptoMarquee";
import CryptoPortfolio from "./components/CryptoPortfolio";
import LoginPage from "./components/LoginPage";
import { resolveAndFetchPrecios } from "./utils/coinGecko";

export default function Home() {
  const [precios, setPrecios] = useState({});
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('portfolioSession');
    if (savedSession) {
      setUser(JSON.parse(savedSession));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setShowLogin(false);
    localStorage.setItem('portfolioSession', JSON.stringify(userData));
  };

  const handleGuestLogin = () => {
    const guestData = { isGuest: true };
    setUser(guestData);
    setShowLogin(false);
    localStorage.setItem('portfolioSession', JSON.stringify(guestData));
  };

  const handleLogout = () => {
    if (user?.isGuest) {
      setShowLogin(true);
    } else {
      setUser(null);
      localStorage.removeItem('portfolioSession');
      localStorage.removeItem('cryptoPortfolio');
      localStorage.removeItem('cryptoOrder');
    }
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

  if (showLogin) {
    return <LoginPage onLogin={handleLogin} onGuestLogin={handleGuestLogin} />;
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} onGuestLogin={handleGuestLogin} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <CryptoMarquee precios={precios} />
      <div className="flex justify-end p-4">
        <button
          onClick={handleLogout}
          className="text-xs text-[#00ff00]/50 hover:text-[#00ff00] font-mono transition-colors duration-300 flex items-center gap-1"
        >
          {user?.isGuest ? '⇥ login' : '⇤ logout'}
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-start mt-4 p-4 md:p-8 w-full">
        <div className="w-full max-w-2xl">
          <CryptoPortfolio precios={precios} setPrecios={setPrecios} />
        </div>
      </div>
    </div>
  );
}
