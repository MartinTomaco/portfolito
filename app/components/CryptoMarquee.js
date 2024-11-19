'use client'
import { useState, useEffect } from 'react';

export default function CryptoMarquee({ precios }) {
  const cryptoList = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
  
  const formatChange = (change) => {
    return change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
  };

  return (
    <div className="w-full bg-black border-b border-[#00ff00]/20 overflow-hidden">
      <div className="animate-marquee whitespace-nowrap py-2 text-sm md:text-base">
        {[...cryptoList, ...cryptoList].map((symbol, index) => (
          <span 
            key={index}
            className="mx-2 md:mx-8 text-[#00ff00] font-mono inline-block"
          >
            <span>{symbol}: ${precios[symbol]?.price?.toLocaleString() || '0'}</span>
            <span className={`ml-1 md:ml-2 ${
              precios[symbol]?.change24h > 0 
                ? 'text-[#00ff00] drop-shadow-[0_0_5px_#00ff00]' 
                : 'text-[#ff0000] drop-shadow-[0_0_5px_#ff0000]'
            }`}>
              {formatChange(precios[symbol]?.change24h || 0)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
} 