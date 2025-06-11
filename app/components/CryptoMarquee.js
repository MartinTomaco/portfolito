'use client'
import { useState, useEffect, useRef } from 'react';

export default function CryptoMarquee({ precios }) {
  const cryptoList = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [finalPosition, setFinalPosition] = useState(0);
  
  const formatChange = (change) => {
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.pageX);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setFinalPosition(currentPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setFinalPosition(currentPosition);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX;
    const walk = (x - startX);
    setCurrentPosition(finalPosition + walk);
  };

  // Crear una lista continua duplicando los elementos
  const continuousList = [...cryptoList, ...cryptoList, ...cryptoList, ...cryptoList];

  return (
    <div className="w-full bg-black border-b border-[#00ff00]/20 overflow-hidden relative">
      <div 
        ref={containerRef}
        className="cursor-grab active:cursor-grabbing scrollbar-hide select-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="inline-flex whitespace-nowrap">
          <div 
            className={`inline-flex ${!isDragging && 'animate-marquee'}`}
            style={isDragging ? {
              transform: `translateX(${currentPosition}px)`,
              transition: 'transform 0.1s ease-out'
            } : undefined}
          >
            {continuousList.map((symbol, index) => (
              <span 
                key={index}
                className="mx-2 md:mx-8 text-[#00ff00] font-mono inline-block text-sm md:text-base"
              >
                <span>{symbol}: ${precios[symbol]?.price?.toString() || '0'}</span>
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
      </div>
    </div>
  );
}