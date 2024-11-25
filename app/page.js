'use client'
import { useState, useEffect } from 'react';
import CryptoMarquee from "./components/CryptoMarquee";
import CryptoPortfolio from "./components/CryptoPortfolio";
import LoginPage from "./components/LoginPage";

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
        
        const symbolToId = {
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

        const ids = allSymbols
          .map(symbol => symbolToId[symbol] || symbol.toLowerCase())
          .join(',');

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await response.json();
        
        const preciosFormateados = {};
        allSymbols.forEach(symbol => {
          const id = symbolToId[symbol] || symbol.toLowerCase();
          if (data[id]) {
            preciosFormateados[symbol] = {
              price: data[id].usd,
              change24h: data[id].usd_24h_change
            };
          }
        });
        
        setPrecios(preciosFormateados);
      } catch (error) {
        console.error('Error al obtener precios:', error);
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
          className="px-4 py-2 border border-[#00ff00] text-[#00ff00] rounded hover:bg-[#00ff00]/10 font-mono transition-colors"
        >
          {user.isGuest ? 'Iniciar Sesión' : 'Cerrar Sesión'}
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
