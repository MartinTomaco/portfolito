'use client'
import { useState, useEffect } from 'react';
import CryptoMarquee from "./components/CryptoMarquee";
import CryptoPortfolio from "./components/CryptoPortfolio";

export default function Home() {
  const [precios, setPrecios] = useState({});

  useEffect(() => {
    const fetchPrecios = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,ripple&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await response.json();
        
        const preciosFormateados = {
          BTC: { price: data.bitcoin.usd, change24h: data.bitcoin.usd_24h_change },
          ETH: { price: data.ethereum.usd, change24h: data.ethereum.usd_24h_change },
          BNB: { price: data.binancecoin.usd, change24h: data.binancecoin.usd_24h_change },
          SOL: { price: data.solana.usd, change24h: data.solana.usd_24h_change },
          XRP: { price: data.ripple.usd, change24h: data.ripple.usd_24h_change }
        };
        
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
      <div className="flex-1 flex flex-col items-center justify-start mt-20 p-4 md:p-8">
        <CryptoPortfolio precios={precios} />
      </div>
    </div>
  );
}
