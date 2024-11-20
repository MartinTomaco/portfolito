'use client'
import { useState, useEffect } from 'react';
import CryptoModal from './CryptoModal';

export default function CryptoPortfolio({ precios, setPrecios }) {
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
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [cryptoOrder, setCryptoOrder] = useState([]);

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

  useEffect(() => {
    if (isClient) {
      const savedOrder = localStorage.getItem('cryptoOrder');
      if (savedOrder) {
        setCryptoOrder(JSON.parse(savedOrder));
      } else {
        setCryptoOrder(Object.keys(portfolio));
      }
    }
  }, [isClient, portfolio]);

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

  const handleOpenModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const fetchNewCryptoPrice = async (symbol) => {
    try {
      const searchResponse = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${symbol}`
      );
      const searchData = await searchResponse.json();
      
      if (searchData.coins.length > 0) {
        const coinId = searchData.coins[0].id;
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await response.json();
        
        if (data[coinId]) {
          return {
            price: data[coinId].usd,
            change24h: data[coinId].usd_24h_change
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error al obtener precio:', error);
      return null;
    }
  };

  const handleModalSubmit = async (symbol, amount) => {
    if (modalType === 'add') {
      const newPrice = await fetchNewCryptoPrice(symbol);
      if (newPrice) {
        setPrecios(prev => ({
          ...prev,
          [symbol]: newPrice
        }));
      }
      
      setPortfolio(prev => ({
        ...prev,
        [symbol]: (prev[symbol] || 0) + amount
      }));
    } else {
      setPortfolio(prev => {
        const newAmount = (prev[symbol] || 0) - amount;
        const newPortfolio = { ...prev };
        if (newAmount <= 0) {
          delete newPortfolio[symbol];
        } else {
          newPortfolio[symbol] = newAmount;
        }
        return newPortfolio;
      });
    }
  };

  const handleDragStart = (e, crypto) => {
    e.dataTransfer.setData('text/plain', crypto);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetCrypto) => {
    e.preventDefault();
    const draggedCrypto = e.dataTransfer.getData('text/plain');
    
    if (draggedCrypto !== targetCrypto) {
      const newOrder = [...cryptoOrder];
      const draggedIndex = newOrder.indexOf(draggedCrypto);
      const targetIndex = newOrder.indexOf(targetCrypto);
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCrypto);
      
      setCryptoOrder(newOrder);
      localStorage.setItem('cryptoOrder', JSON.stringify(newOrder));
    }
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
          un portfolio cripto simple.
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
          {cryptoOrder
            .filter(crypto => portfolio[crypto] > 0)
            .map((crypto) => (
              <tr 
                key={crypto} 
                className="border-b border-[#00ff00]/10 hover:bg-[#00ff00]/5 cursor-move"
                draggable="true"
                onDragStart={(e) => handleDragStart(e, crypto)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, crypto)}
              >
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
                        defaultValue={portfolio[crypto]}
                        onBlur={(e) => handleSave(crypto, e.target.value)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1 h-full">
                      <span>{portfolio[crypto]}</span>
                      <span className="opacity-0 group-hover:opacity-100 text-xs">✎</span>
                    </div>
                  )}
                </td>
                <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm px-1 sm:px-2">
                  ${precios[crypto]?.price?.toLocaleString()}
                </td>
                <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm">
                  ${((portfolio[crypto] * (precios[crypto]?.price || 0))).toLocaleString(undefined, {maximumFractionDigits: 0})}
                </td>
              </tr>
            ))
          }
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
      <div className="flex gap-3 mt-6 px-2 sm:px-4 justify-end">
        <button 
          onClick={() => handleOpenModal('add')}
          className="w-8 h-8 rounded-full border-2 border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00]/10 flex items-center justify-center text-xl font-bold transition-all duration-300 hover:shadow-[0_0_15px_#00ff00]"
        >
          +
        </button>
        <button 
          onClick={() => handleOpenModal('remove')}
          className="w-8 h-8 rounded-full border-2 border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00]/10 flex items-center justify-center text-xl font-bold transition-all duration-300 hover:shadow-[0_0_15px_#00ff00]"
        >
          -
        </button>
      </div>
      <CryptoModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleModalSubmit}
        type={modalType}
        existingCryptos={Object.keys(portfolio)}
      />
    </div>
  );
} 