'use client'
import { useState, useEffect } from "react";
import CryptoMarquee from "./components/CryptoMarquee";
import confetti from 'canvas-confetti';

export default function Home() {
  const [btcPrice, setBtcPrice] = useState(0);

  // Obtener el precio de BTC
  useEffect(() => {
    const fetchBTCPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        );
        const data = await response.json();
        setBtcPrice(data.bitcoin.usd);
      } catch (error) {
        console.error('Error al obtener precio de BTC:', error);
      }
    };

    fetchBTCPrice();
    const interval = setInterval(fetchBTCPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const lanzarConfeti = () => {
    const emojis = ['💰', '🚀', '🌕', '💎', '🎉'];
    
    // Crear elemento con el precio
    const precioElemento = document.createElement('div');
    precioElemento.innerText = `$${btcPrice.toLocaleString()}`;
    precioElemento.className = 'emoji-flotante';
    precioElemento.style.cssText = `
      position: fixed;
      font-size: 3rem;
      font-family: 'Courier New', monospace;
      color: #00ff00;
      text-shadow: 0 0 10px #00ff00;
      user-select: none;
      z-index: 1000;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      animation: aparecer 2s ease-out forwards;
    `;
    document.body.appendChild(precioElemento);
    setTimeout(() => precioElemento.remove(), 2000);

    // Resto del código del confeti...
    const defaults = {
      spread: 360,
      ticks: 100,
      gravity: 0.5,
      decay: 0.94,
      startVelocity: 30,
      shapes: ['circle'],
      colors: ['#FFD700', '#00ff00', '#ffffff']
    };

    function shoot() {
      confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ['circle']
      });

      confetti({
        ...defaults,
        particleCount: 20,
        scalar: 2.5,
        shapes: ['circle']
      });
    }

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
    
    emojis.forEach((emoji, index) => {
      const elemento = document.createElement('div');
      elemento.innerText = emoji;
      elemento.className = 'emoji-flotante';
      elemento.style.cssText = `
        position: fixed;
        font-size: 2rem;
        user-select: none;
        z-index: 1000;
        left: ${Math.random() * 100}vw;
        top: 100vh;
        animation: flotar 2s ease-out forwards;
        animation-delay: ${index * 0.2}s;
      `;
      document.body.appendChild(elemento);
      setTimeout(() => elemento.remove(), 2000);
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <CryptoMarquee />
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <button 
          onClick={lanzarConfeti}
          className="px-12 py-6 text-2xl font-mono font-bold text-[#0a0a0a] bg-[#00ff00] 
                   rounded-xl hover:bg-[#00dd00] transition-all duration-300
                   border-2 border-[#00ff00] hover:shadow-[0_0_30px_#00ff00]
                   transform hover:scale-105 active:scale-95"
        >
          🎉 CELEBRAR BTC ${btcPrice.toLocaleString()} 🚀
        </button>
      </div>
    </div>
  );
}
