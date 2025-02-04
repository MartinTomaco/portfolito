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
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [cryptoOrder, setCryptoOrder] = useState([]);
  const [hideBalances, setHideBalances] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hideBalances');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

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
        const initialOrder = Object.keys(portfolio);
        setCryptoOrder(initialOrder);
        localStorage.setItem('cryptoOrder', JSON.stringify(initialOrder));
      }
    }
  }, [isClient, portfolio]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('hideBalances', JSON.stringify(hideBalances));
    }
  }, [hideBalances, isClient]);

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

      if (!cryptoOrder.includes(symbol)) {
        setCryptoOrder(prev => [...prev, symbol]);
        localStorage.setItem('cryptoOrder', JSON.stringify([...cryptoOrder, symbol]));
      }
    } else {
      setPortfolio(prev => {
        const newAmount = (prev[symbol] || 0) - amount;
        const newPortfolio = { ...prev };
        if (newAmount <= 0) {
          delete newPortfolio[symbol];
          const newOrder = cryptoOrder.filter(crypto => crypto !== symbol);
          setCryptoOrder(newOrder);
          localStorage.setItem('cryptoOrder', JSON.stringify(newOrder));
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
      <div className="mb-6 text-center flex flex-col items-center">
        <h1 className="text-[#00ff00] text-2xl sm:text-3xl font-bold font-mono mb-2">
          Portfolito
        </h1>
        <p className="text-[#00ff00]/70 text-sm sm:text-base font-mono mb-2">
          un portfolio cripto simple.
        </p>
        <button
          onClick={() => setHideBalances(!hideBalances)}
          className="flex items-center gap-2 text-[#00ff00]/70 hover:text-[#00ff00] transition-colors duration-300 font-mono text-sm mt-2"
        >
          <svg 
            className={`w-5 h-5 ${hideBalances ? 'line-through' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            {hideBalances ? (
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            ) : (
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            )}
          </svg>
          <span className={hideBalances ? 'line-through' : ''}>mostrar saldos</span>
        </button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#00ff00]/30">
            <th className="py-2 text-left font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[30%]">Crypto</th>
            <th className="py-2 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[20%]">Cant.</th>
            <th className="py-2 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[25%]">Precio 24h %</th>
            <th className="py-2 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[25%]">Total USD</th>
          </tr>
        </thead>
        <tbody>
          {cryptoOrder.map((crypto) => (
            <tr key={crypto} className="border-b border-[#00ff00]/10">
              <td className="py-2 font-mono text-[#00ff00] text-xs sm:text-sm">{crypto}</td>
              <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[80px]">
                <div className="flex items-center justify-end gap-1">
                  <span className="inline-block min-w-[40px] text-right">
                    {hideBalances ? '***' : portfolio[crypto]}
                  </span>
                </div>
              </td>
              <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[120px]">
                <div className="flex items-center justify-end gap-2">
                  <span className="inline-block min-w-[60px] text-right">
                    ${precios[crypto]?.price?.toLocaleString()}
                  </span>
                  <span className={`inline-block min-w-[60px] text-right ${
                    precios[crypto]?.change24h === undefined
                      ? 'text-[#00ff00]/50'
                      : precios[crypto]?.change24h > 0 
                        ? 'text-[#00ff00]' 
                        : 'text-[#ff0000]'
                  }`}>
                    {precios[crypto]?.change24h === undefined
                      ? 'N/A'
                      : `${precios[crypto]?.change24h > 0 ? '+' : ''}${precios[crypto]?.change24h.toFixed(2)}%`
                    }
                  </span>
                </div>
              </td>
              <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[100px]">
                <span className="inline-block min-w-[80px] text-right">
                  ${hideBalances ? '***' : ((portfolio[crypto] * (precios[crypto]?.price || 0))).toLocaleString(undefined, {maximumFractionDigits: 0})}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#00ff00]/30">
            <td colSpan="3" className="py-2 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm">
              Total:
            </td>
            <td className="py-2 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm min-w-[100px]">
              <span className="inline-block min-w-[80px] text-right">
                ${hideBalances ? '***' : totalPortfolio.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </span>
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
        portfolio={portfolio}
      />
    </div>
  );
} 