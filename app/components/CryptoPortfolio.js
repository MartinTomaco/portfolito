'use client'
import { useState, useEffect } from 'react';

export default function CryptoPortfolio() {
  const [isClient, setIsClient] = useState(false);
  const [portfolio, setPortfolio] = useState({
    BTC: 0,
    ETH: 0,
    BNB: 0,
    SOL: 0,
    XRP: 0
  });
  const [precios, setPrecios] = useState({});
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
    if (isClient) {
      localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
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
    <div className="w-full max-w-2xl mx-auto p-6 rounded-xl border border-[#00ff00]/20 bg-black/50 backdrop-blur-sm">
      <h2 className="text-2xl font-mono text-[#00ff00] mb-6 text-center drop-shadow-[0_0_5px_#00ff00]">
        Mi Portfolio Crypto
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#00ff00]/20">
              <th className="py-3 text-left text-[#00ff00] font-mono">Crypto</th>
              <th className="py-3 text-right text-[#00ff00] font-mono">Cantidad</th>
              <th className="py-3 text-right text-[#00ff00] font-mono">Precio</th>
              <th className="py-3 text-right text-[#00ff00] font-mono">Total USD</th>
              <th className="py-3 text-center text-[#00ff00] font-mono">Acción</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(portfolio).map(([crypto, cantidad]) => (
              <tr key={crypto} className="border-b border-[#00ff00]/10 hover:bg-[#00ff00]/5">
                <td className="py-3 font-mono text-[#00ff00]">{crypto}</td>
                <td className="py-3 text-right font-mono text-[#00ff00]">
                  {editando === crypto ? (
                    <input
                      type="number"
                      className="w-24 px-2 py-1 bg-black border border-[#00ff00] text-[#00ff00] font-mono rounded"
                      defaultValue={cantidad}
                      onBlur={(e) => handleSave(crypto, e.target.value)}
                      autoFocus
                    />
                  ) : (
                    cantidad
                  )}
                </td>
                <td className="py-3 text-right font-mono text-[#00ff00]">
                  ${precios[crypto]?.price?.toLocaleString() || '0'}
                </td>
                <td className="py-3 text-right font-mono text-[#00ff00]">
                  ${((cantidad * (precios[crypto]?.price || 0))).toLocaleString()}
                </td>
                <td className="py-3 text-center">
                  <button
                    onClick={() => handleEdit(crypto)}
                    className="px-3 py-1 text-sm font-mono text-black bg-[#00ff00] rounded-md
                             hover:bg-[#00dd00] transition-all duration-300
                             hover:shadow-[0_0_10px_#00ff00]"
                  >
                    Editar
                  </button>
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
                ${totalPortfolio.toLocaleString()}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
} 