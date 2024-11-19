'use client'
import { useState, useEffect } from 'react';

export default function CryptoMarquee() {
  const [precios, setPrecios] = useState([
    { symbol: 'BTC', price: '0', change24h: '0' },
    { symbol: 'ETH', price: '0', change24h: '0' },
    { symbol: 'BNB', price: '0', change24h: '0' },
    { symbol: 'SOL', price: '0', change24h: '0' },
    { symbol: 'XRP', price: '0', change24h: '0' },
  ]);

  useEffect(() => {
    const fetchPrecios = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,ripple&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await response.json();
        
        setPrecios([
          { 
            symbol: 'BTC', 
            price: data.bitcoin.usd,
            change24h: data.bitcoin.usd_24h_change
          },
          { 
            symbol: 'ETH', 
            price: data.ethereum.usd,
            change24h: data.ethereum.usd_24h_change
          },
          { 
            symbol: 'BNB', 
            price: data.binancecoin.usd,
            change24h: data.binancecoin.usd_24h_change
          },
          { 
            symbol: 'SOL', 
            price: data.solana.usd,
            change24h: data.solana.usd_24h_change
          },
          { 
            symbol: 'XRP', 
            price: data.ripple.usd,
            change24h: data.ripple.usd_24h_change
          },
        ]);
      } catch (error) {
        console.error('Error al obtener precios:', error);
      }
    };

    fetchPrecios();
    const interval = setInterval(fetchPrecios, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, []);

  const formatChange = (change) => {
    const num = Number(change).toFixed(2);
    return num > 0 ? `+${num}%` : `${num}%`;
  };

  return (
    <div className="w-full bg-black border-b border-[#00ff00]/20 overflow-hidden">
      <div className="animate-marquee whitespace-nowrap py-2">
        {[...precios, ...precios].map((crypto, index) => (
          <span 
            key={index}
            className="mx-8 text-[#00ff00] font-mono inline-block"
          >
            <span>{crypto.symbol}: ${Number(crypto.price).toLocaleString()}</span>
            <span className={`ml-2 ${
              crypto.change24h > 0 
                ? 'text-[#00ff00] drop-shadow-[0_0_5px_#00ff00]' 
                : 'text-[#ff0000] drop-shadow-[0_0_5px_#ff0000]'
            }`}>
              {formatChange(crypto.change24h)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
} 