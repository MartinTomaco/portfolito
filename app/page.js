'use client'
import { useState, useEffect } from 'react';
import CryptoMarquee from "./components/CryptoMarquee";
import CryptoPortfolio from "./components/CryptoPortfolio";

export default function Home() {
  const [precios, setPrecios] = useState({});

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

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <CryptoMarquee precios={precios} />
      <div className="flex-1 flex flex-col items-center justify-start mt-20 p-4 md:p-8 w-full">
        <div className="w-full max-w-2xl">
          <CryptoPortfolio precios={precios} setPrecios={setPrecios} />
        </div>
      </div>
    </div>
  );
}
