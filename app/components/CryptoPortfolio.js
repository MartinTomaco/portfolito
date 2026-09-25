'use client'
import { useState, useEffect, useMemo, useRef } from 'react';
import CryptoModal from './CryptoModal';
import {
  isValidPrice,
  getRealPrice,
  applyScrollOffset,
  computeSnapshot,
  formatPrice,
  formatUsd,
  formatPercent
} from '../utils/simulation';

// Píxeles de dedo por paso en el swipe de mobile. El dedo recorre mucho menos
// recorrido útil que un notch de rueda, asi que necesita un paso mas largo
// para no irse al extremo de una: 10 -> 40 -> 160 -> 320px, afinado a mano.
// No afecta la rueda, que usa el paso adaptativo de applyScrollOffset.
const SWIPE_STEP_PX = 320;

const EMPTY_ROW = {
  amount: 0,
  realPrice: null,
  price: null,
  offset: 0,
  isSimulated: false,
  value: 0,
  realValue: 0,
  delta: 0
};

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
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [cryptoOrder, setCryptoOrder] = useState([]);
  const [simulaciones, setSimulaciones] = useState({});
  const [armedSymbol, setArmedSymbol] = useState(null);
  const [hideBalances, setHideBalances] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hideBalances');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  const tableRef = useRef(null);
  const swipeRef = useRef(null);
  const wheelFrameRef = useRef(null);
  const wheelContextRef = useRef(null);
  const suppressClickRef = useRef(false);

  const snapshot = useMemo(
    () => computeSnapshot(portfolio, precios, simulaciones),
    [portfolio, precios, simulaciones]
  );

  // Varias filas pueden quedar simuladas a la vez; armedSymbol es la que
  // responde a la rueda o al swipe, y puede cambiar cuantas veces quieras.
  const simulacionActiva = Object.keys(simulaciones).length > 0;

  // Descarta la fila armada si su activo deja de existir o de tener precio.
  useEffect(() => {
    setSimulaciones(prev => {
      const entries = Object.entries(prev).filter(
        ([symbol]) => isValidPrice(getRealPrice(precios, symbol)) && symbol in portfolio
      );
      if (entries.length === Object.keys(prev).length) return prev;
      return entries.length > 0 ? Object.fromEntries(entries) : {};
    });
  }, [portfolio, precios]);

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
    const table = tableRef.current;
    if (!table) return;

    const flushWheel = () => {
      const context = wheelContextRef.current;
      wheelContextRef.current = null;
      wheelFrameRef.current = null;
      if (!context) return;

      const { symbol, direction, fast, realPrice } = context;
      setSimulaciones(prev => {
        const current = prev[symbol] || 0;
        const next = applyScrollOffset(current, direction, realPrice, { fast });
        return next === current ? prev : { ...prev, [symbol]: next };
      });
    };

    const handleWheel = (event) => {
      if (event.ctrlKey) return;
      if (event.deltaY === 0) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (!armedSymbol) return;

      const symbol = armedSymbol;
      const realPrice = getRealPrice(precios, symbol);
      if (!isValidPrice(realPrice)) return;

      event.preventDefault();

      wheelContextRef.current = {
        symbol,
        direction: event.deltaY < 0 ? 1 : -1,
        fast: event.shiftKey,
        realPrice
      };

      if (wheelFrameRef.current == null) {
        wheelFrameRef.current = requestAnimationFrame(flushWheel);
      }
    };

    table.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      table.removeEventListener('wheel', handleWheel);
      if (wheelFrameRef.current != null) {
        cancelAnimationFrame(wheelFrameRef.current);
        wheelFrameRef.current = null;
      }
      wheelContextRef.current = null;
    };
  }, [precios, isClient, armedSymbol]);

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

  const handleEdit = (crypto) => {
    setEditando(crypto);
  };

  const handleSave = (crypto, valor) => {
    setPortfolio(prev => ({
      ...prev,
      [crypto]: formatCryptoAmount(parseFloat(valor) || 0)
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
      
      if (!searchResponse.ok) {
        console.warn(`No se pudo buscar ${symbol}:`, searchResponse.status);
        return null;
      }
      
      const searchData = await searchResponse.json();
      
      if (!searchData || !searchData.coins || searchData.coins.length === 0) {
        console.warn(`No se encontró información para ${symbol}`);
        return null;
      }
      
      const coinId = searchData.coins[0].id;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
      );
      
      if (!response.ok) {
        console.warn(`No se pudo obtener precio para ${symbol}:`, response.status);
        return null;
      }
      
      const data = await response.json();
      
      if (data && data[coinId] && data[coinId].usd !== undefined) {
        return {
          price: data[coinId].usd,
          change24h: data[coinId].usd_24h_change
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`Error al obtener precio para ${symbol}:`, error.message);
      return null;
    }
  };

  const handleModalSubmit = async (symbol, amount) => {
    if (modalType === 'add') {
      try {
        const newPrice = await fetchNewCryptoPrice(symbol);
        if (newPrice) {
          setPrecios(prev => ({
            ...prev,
            [symbol]: newPrice
          }));
        } else {
          // Si no se encuentra precio, agregar el símbolo sin precio para que se muestre como "Sin precio"
          setPrecios(prev => ({
            ...prev,
            [symbol]: null
          }));
        }
      } catch (error) {
        console.warn(`Error al obtener precio para ${symbol}, agregando sin precio`);
        setPrecios(prev => ({
          ...prev,
          [symbol]: null
        }));
      }
      
      setPortfolio(prev => ({
        ...prev,
        [symbol]: formatCryptoAmount((prev[symbol] || 0) + amount)
      }));

      if (!cryptoOrder.includes(symbol)) {
        setCryptoOrder(prev => [...prev, symbol]);
        localStorage.setItem('cryptoOrder', JSON.stringify([...cryptoOrder, symbol]));
      }
    } else {
      setPortfolio(prev => {
        const newAmount = formatCryptoAmount((prev[symbol] || 0) - amount);
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

  const resetSimulacion = () => {
    setSimulaciones({});
    setArmedSymbol(null);
  };

  // Tocar cualquier celda de la fila la deja seleccionada (verde + cursor):
  // responde a la rueda, al swipe y es la que precarga el modal de + y -.
  const handleSelectRow = (symbol) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (!isValidPrice(getRealPrice(precios, symbol))) return;

    setArmedSymbol(symbol);
    setSimulaciones(prev => (symbol in prev ? prev : { ...prev, [symbol]: 0 }));
  };

  const handleSwipeStart = (event) => {
    // Cada gesto nuevo arranca limpio: si un swipe anterior no llegó a generar
    // click, el flag quedaba en true y se comía el siguiente toque.
    suppressClickRef.current = false;
    if (event.pointerType === 'mouse') return;

    const symbol = event.currentTarget.dataset.swipeSymbol || event.currentTarget.dataset.symbol;
    if (armedSymbol !== symbol) return;

    const realPrice = getRealPrice(precios, symbol);
    if (!isValidPrice(realPrice)) return;

    swipeRef.current = {
      symbol,
      realPrice,
      pointerId: event.pointerId,
      startY: event.clientY,
      accumulated: 0
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSwipeMove = (event) => {
    const state = swipeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    state.accumulated += state.startY - event.clientY;
    const steps = Math.trunc(state.accumulated / SWIPE_STEP_PX);
    if (steps === 0) return;

    state.accumulated -= steps * SWIPE_STEP_PX;
    const direction = steps > 0 ? 1 : -1;
    const count = Math.abs(steps);
    suppressClickRef.current = true;

    setSimulaciones(prev => {
      const current = prev[state.symbol] || 0;
      const next = applyScrollOffset(current, direction, state.realPrice, { steps: count });
      return next === current ? prev : { ...prev, [state.symbol]: next };
    });
  };

  const handleSwipeEnd = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    swipeRef.current = null;
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

  const formatCryptoAmount = (value) => parseFloat(value.toPrecision(10));

  if (!isClient) {
    return null; // o un estado de carga
  }

  return (
    <div className="w-full max-w-4xl px-2 sm:px-4">
      <div className="mb-6 text-center flex flex-col items-center">
        <h1 className="text-[#00ff00] text-2xl sm:text-3xl font-bold font-mono mb-2 flex items-center">
          Portfolit
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="inline-flex items-center hover:text-[#00ff00] transition-colors duration-300"
          >
            <svg 
              className="w-7 h-7 sm:w-8 sm:h-8" 
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
          </button>
        </h1>
        <p className="text-[#00ff00]/70 text-sm sm:text-base font-mono mb-2">
          un portfolio cripto simple.
        </p>
      </div>
      <div className="table-scroll">
      <table ref={tableRef} className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#00ff00]/30">
            <th className="py-2 text-left font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[30%]">Crypto</th>
            <th className="py-2 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[20%]">Cant.</th>
            <th className="py-2 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[25%] whitespace-nowrap">
              {simulacionActiva ? (
                <span title="columna en modo simulación">
                  <span className="line-through text-[#00ff00]/40">24h</span>
                  <span className="hidden sm:inline text-[#00ff00]"> simulación</span>
                  <span className="sm:hidden text-[#00ff00]"> sim</span>
                </span>
              ) : (
                'Precio 24h %'
              )}
            </th>
            <th className="py-2 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[25%]">Total (USD %)</th>
          </tr>
        </thead>
        <tbody>
          {cryptoOrder.map((crypto) => {
            const row = snapshot.porActivo[crypto] || EMPTY_ROW;
            const { amount, realPrice, price, offset, isSimulated, value, delta } = row;
            const participationPercentage = snapshot.total > 0 ? (value / snapshot.total) * 100 : 0;
            const isUp = offset > 0;
            const isDown = offset < 0;
            const isArmed = armedSymbol === crypto;
            const enSimulacion = crypto in simulaciones;
            const simColor = isUp ? 'text-[#00ff00]' : isDown ? 'text-[#ff0000]' : 'text-[#00ff00]/50';
            const simGlow = isUp
              ? 'drop-shadow-[0_0_6px_#00ff00]'
              : isDown
                ? 'drop-shadow-[0_0_6px_#ff0000]'
                : '';
            return (
              <tr
                key={crypto}
                data-symbol={crypto}
                onClick={() => handleSelectRow(crypto)}
                className={`border-b border-[#00ff00]/10 ${realPrice !== null ? 'sim-row' : ''} ${isArmed || isSimulated ? 'bg-[#00ff00]/5' : ''} transition-colors duration-200`}
              >
                <td className="py-2 font-mono text-[#00ff00] text-xs sm:text-sm">
                  <span className="inline-flex items-center">
                    <span
                      aria-hidden="true"
                      className={`inline-block w-[7px] ${isArmed ? 'sim-cursor text-[#00ff00]' : 'invisible'}`}
                    >
                      ▌
                    </span>
                    {crypto}
                  </span>
                </td>
                <td className="py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[56px] sm:min-w-[80px]">
                  <div className="flex items-center justify-end gap-1">
                    <span className="inline-block min-w-[40px] text-right">
                      {hideBalances ? '***' : formatCryptoAmount(amount)}
                    </span>
                  </div>
                </td>
                <td
                  data-symbol={crypto}
                  onPointerDown={handleSwipeStart}
                  onPointerMove={handleSwipeMove}
                  onPointerUp={handleSwipeEnd}
                  onPointerCancel={handleSwipeEnd}
                  title={isArmed ? 'Girá la rueda para ajustar este precio' : 'Click para simular este precio'}
                  className={`py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[104px] sm:min-w-[120px] relative ${isArmed ? 'sim-price-cell cursor-ns-resize' : ''}`}
                >
                  {isSimulated && (
                    <span
                      aria-hidden="true"
                      className={`sim-float sim-float-${isUp ? 'up' : 'down'} ${simColor}`}
                    >
                      {formatUsd(delta, { signed: true })}
                    </span>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    {price !== null ? (
                      <span className={`inline-block min-w-[52px] sm:min-w-[60px] text-right whitespace-nowrap ${isSimulated ? simGlow : ''}`}>
                        {`$${formatPrice(price)}`}
                      </span>
                    ) : (
                      <span className="inline-block min-w-[52px] sm:min-w-[60px] text-right text-[#00ff00]/50">Sin precio</span>
                    )}
                    {enSimulacion ? (
                      <span className={`inline-block min-w-[48px] sm:min-w-[60px] text-right ${simColor} ${simGlow}`}>
                        {formatPercent(offset)}
                      </span>
                    ) : (
                      <span className={`inline-block min-w-[48px] sm:min-w-[60px] text-right ${
                        !precios[crypto] || precios[crypto] === null || precios[crypto]?.change24h === undefined || precios[crypto]?.change24h === null || typeof precios[crypto]?.change24h !== 'number'
                          ? 'text-[#00ff00]/50'
                          : precios[crypto]?.change24h > 0 
                            ? 'text-[#00ff00]' 
                            : 'text-[#ff0000]'
                      }`}>
                        {!precios[crypto] || precios[crypto] === null || precios[crypto]?.change24h === undefined || precios[crypto]?.change24h === null || typeof precios[crypto]?.change24h !== 'number'
                          ? 'N/A'
                          : `${precios[crypto]?.change24h > 0 ? '+' : ''}${precios[crypto]?.change24h.toFixed(2)}%`
                        }
                      </span>
                    )}
                  </div>
                </td>
                <td
                  data-swipe-symbol={isArmed ? crypto : undefined}
                  onPointerDown={isArmed ? handleSwipeStart : undefined}
                  onPointerMove={isArmed ? handleSwipeMove : undefined}
                  onPointerUp={isArmed ? handleSwipeEnd : undefined}
                  onPointerCancel={isArmed ? handleSwipeEnd : undefined}
                  className={`py-2 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[56px] sm:min-w-[100px] ${isArmed ? 'sim-value-cell' : ''}`}
                >
                  <span className="inline-block min-w-[48px] sm:min-w-[80px] text-right whitespace-nowrap">
                    {hideBalances ? '***' : (
                      <>
                        {price !== null
                          ? (
                            <>
                              {formatUsd(value)}
                              <span className="ml-1.5 sm:ml-2 text-[9px] sm:text-[10px] text-[#00ff00]/70">
                                {participationPercentage.toFixed(1)}%
                              </span>
                            </>
                          )
                          : (
                            <span className="text-[#00ff00]/50">Sin precio</span>
                          )
                        }
                      </>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#00ff00]/30">
            <td colSpan="3" className="py-2 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm">
              Total:
            </td>
            <td className="py-2 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm min-w-[64px] sm:min-w-[100px] relative">
              {snapshot.hasSim && !hideBalances && (
                <span
                  aria-hidden="true"
                  className={`sim-float sim-float-${snapshot.totalDelta > 0 ? 'up' : 'down'} ${snapshot.totalDelta > 0 ? 'text-[#00ff00]' : 'text-[#ff0000]'}`}
                >
                  {formatUsd(snapshot.totalDelta, { signed: true })}
                </span>
              )}
              <span className="inline-block min-w-[52px] sm:min-w-[80px] text-right whitespace-nowrap">
                {hideBalances ? '***' : formatUsd(snapshot.total)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
      <div className="flex items-center justify-between gap-3 mt-6 px-2 sm:px-4">
        {simulacionActiva && (
          <button
            onClick={resetSimulacion}
            title="Volver todos los precios al valor real"
            className="px-2 py-1 border border-[#00ff00]/60 text-[#00ff00] text-[10px] sm:text-xs font-mono transition-all duration-300 hover:bg-[#00ff00]/10 hover:shadow-[0_0_10px_#00ff00]"
          >
            volver a real
          </button>
        )}
        <div className="flex gap-3 ml-auto">
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
      </div>
      <CryptoModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleModalSubmit}
        type={modalType}
        existingCryptos={Object.keys(portfolio)}
        portfolio={portfolio}
        initialSymbol={armedSymbol || ''}
      />
    </div>
  );
} 