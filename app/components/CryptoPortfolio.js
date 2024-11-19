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
    <div className="w-full max-w-4xl">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#00ff00]/20">
            <th className="py-3 text-left text-[#00ff00] font-mono">Crypto</th>
            <th className="py-3 text-right text-[#00ff00] font-mono">Cantidad</th>
            <th className="py-3 text-right text-[#00ff00] font-mono">Precio</th>
            <th className="py-3 text-right text-[#00ff00] font-mono">Total USD</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(portfolio).map(([crypto, cantidad]) => (
            <tr key={crypto} className="border-b border-[#00ff00]/10 hover:bg-[#00ff00]/5">
              <td className="py-3 font-mono text-[#00ff00]">{crypto}</td>
              <td 
                className="py-3 text-right font-mono text-[#00ff00] cursor-pointer relative group w-32 h-[52px]"
                onClick={() => handleEdit(crypto)}
              >
                {editando === crypto ? (
                  <div className="absolute inset-0 flex items-center justify-end">
                    <input
                      type="number"
                      className="w-full h-9 px-2 bg-black border border-[#00ff00] text-[#00ff00] font-mono rounded text-right"
                      defaultValue={cantidad}
                      onBlur={(e) => handleSave(crypto, e.target.value)}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2 h-full">
                    <span>{cantidad}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-xs">✎</span>
                  </div>
                )}
              </td>
              <td className="py-3 text-right font-mono text-[#00ff00]">
                ${precios[crypto]?.price?.toLocaleString() || '0'}
              </td>
              <td className="py-3 text-right font-mono text-[#00ff00]">
                ${((cantidad * (precios[crypto]?.price || 0))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#00ff00]/30">
            <td colSpan="3" className="py-4 text-right font-mono text-[#00ff00] font-bold">
              Total Portfolio:
            </td>
            <td className="py-4 text-right font-mono text-[#00ff00] font-bold">
              ${totalPortfolio.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
} 