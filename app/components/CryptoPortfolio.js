'use client'
import { useState, useEffect } from 'react';

export default function CryptoPortfolio({ precios }) {
  const [isClient, setIsClient] = useState(false);
  const [portfolio, setPortfolio] = useState({
    BTC: 0,
    ETH: 0,
    BNB: 0,
    SOL: 0,
    XRP: 0
  });
  const [editando, setEditando] = useState(null);
  const [totalPortfolio, setTotalPortfolio] = useState(0);
  const [randomValue, setRandomValue] = useState(null);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cryptoPortfolio');
      if (saved) {
        setPortfolio(JSON.parse(saved));
      }
    }
  }, []);

  useEffect(() => {
    setRandomValue(Math.random());
  }, []);

  useEffect(() => {
    if (isClient && Object.keys(precios).length > 0) {
      calcularTotal();
    }
  }, [portfolio, precios, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
    }
  }, [portfolio, isClient]);

  const calcularTotal = () => {
    const total = Object.entries(portfolio).reduce((acc, [crypto, cantidad]) => {
      return acc + (cantidad * (precios[crypto]?.price || 0));
    }, 0);
    setTotalPortfolio(total);
  };

  const handleEdit = (crypto) => {
    setEditando(crypto);
  };

  const handleSave = (crypto, valor) => {
    setPortfolio(prev => ({
      ...prev,
      [crypto]: parseFloat(valor) || 0
    }));
    setEditando(null);
  };

  if (!isClient) {
    return null; // o un estado de carga
  }

  return (
    <div className="w-full max-w-4xl px-2 sm:px-4">
      <div className="mb-6 text-center">
        <h1 className="text-[#00ff00] text-2xl sm:text-3xl font-bold font-mono mb-2">
          Portfolito
        </h1>
        <p className="text-[#00ff00]/70 text-sm sm:text-base font-mono">
          portfolio cripto simple
        </p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#00ff00]/20">
            <th className="py-2 text-left text-[#00ff00] font-mono text-xs sm:text-sm">Crypto</th>
            <th className="py-2 text-right text-[#00ff00] font-mono text-xs sm:text-sm px-1 sm:px-2">Cant.</th>
            <th className="py-2 text-right text-[#00ff00] font-mono text-xs sm:text-sm px-1 sm:px-2">Precio</th>
            <th className="py-2 text-right text-[#00ff00] font-mono text-xs sm:text-sm">Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(portfolio).map(([crypto, cantidad]) => (
            <tr key={crypto} className="border-b border-[#00ff00]/10 hover:bg-[#00ff00]/5">
              <td className="py-2 font-mono text-[#00ff00] text-xs sm:text-sm">{crypto}</td>
              <td 
                className="py-2 text-right font-mono text-[#00ff00] cursor-pointer relative group text-xs sm:text-sm px-1 sm:px-2"
                onClick={() => handleEdit(crypto)}
              >
                {editando === crypto ? (
                  <div className="absolute inset-0 flex items-center justify-end">
                    <input
                      type="number"
                      className="w-full h-7 px-1 bg-black border border-[#00ff00] text-[#00ff00] font-mono rounded text-right text-xs sm:text-sm"
                      defaultValue={cantidad}
                      onBlur={(e) => handleSave(crypto, e.target.value)}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1 h-full">
                    <span>{cantidad}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-xs">✎</span>
                  </div>
                )}
              </td>
              <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm px-1 sm:px-2">
                ${precios[crypto]?.price?.toLocaleString()}
              </td>
              <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm">
                ${((cantidad * (precios[crypto]?.price || 0))).toLocaleString(undefined, {maximumFractionDigits: 0})}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#00ff00]/30">
            <td colSpan="3" className="py-2 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm">
              Total:
            </td>
            <td className="py-2 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm">
              ${totalPortfolio.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
} 