'use client'
import { useState, useEffect, useMemo, useRef } from 'react';
import CryptoModal from './CryptoModal';
import EyeIcon from './EyeIcon';
import { resolveAndFetchPrecios } from '../utils/coinGecko';
import {
  isValidPrice,
  getRealPrice,
  applyScrollOffset,
  computeSnapshot,
  formatPrice,
  formatUsd,
  formatPercent,
  canSortColumn,
  sortPortfolioRows
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

// El porcentaje que se ve en la celda: el offset simulado si la fila esta
// simulada, si no el cambio real de 24h. Sale de un solo lugar para que el
// orden por "24hs" no pueda contradecir a la columna.
function getDisplayPercent(symbol, simulaciones, precios) {
  if (symbol in simulaciones) {
    return simulaciones[symbol] ?? 0;
  }
  const change = precios[symbol]?.change24h;
  return typeof change === 'number' ? change : null;
}

// Encabezado de columna: click para alternar asc -> desc -> sin orden. Con el
// ojo cerrado, "Cant." y "Total" quedan deshabilitados (ver canSortColumn) y se
// avisa con el title en vez de dejar un click que no hace nada.
function SortHeader({ label, columnKey, sortConfig, hideBalances, onSort, align = 'right' }) {
  const sortable = canSortColumn(columnKey, hideBalances);
  const active = sortConfig?.key === columnKey;
  const direction = active ? sortConfig.direction : null;
  const arrow = direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '';

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      disabled={!sortable}
      title={
        sortable
          ? active
            ? `Ordenar por ${label.toLowerCase()} ${direction === 'asc' ? 'descendente' : 'ascendente'}`
            : `Ordenar por ${label.toLowerCase()}`
          : 'Mostrá los montos para poder ordenar por esta columna'
      }
      className={`inline-flex items-center gap-0.5 font-mono font-normal transition-colors duration-300 ${
        align === 'right' ? 'flex-row-reverse' : ''
      } ${
        sortable
          ? active
            ? 'text-[#00ff00] cursor-pointer'
            : 'text-[#00ff00]/70 hover:text-[#00ff00] cursor-pointer'
          : 'text-[#00ff00]/30 cursor-not-allowed'
      } ${active ? 'drop-shadow-[0_0_6px_#00ff00]' : ''}`}
    >
      {label}
      <span aria-hidden="true" className="text-[8px] leading-none w-[7px] inline-block">
        {arrow}
      </span>
    </button>
  );
}

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
  // Orden de la vista, aparte de cryptoOrder: ordenar no pisa el orden guardado
  // en localStorage, asi que al borrar el sort las filas vuelven donde estaban.
  // null = sin ordenar, se respeta cryptoOrder.
  const [sortConfig, setSortConfig] = useState(null);
  const [simulaciones, setSimulaciones] = useState({});
  const [armedSymbol, setArmedSymbol] = useState(null);
  // Apagado por defecto: sin tocar el interruptor no se edita ningun precio.
  const [simOn, setSimOn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('simOn') === 'true';
    }
    return false;
  });
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
      if (!simOn) return;
      if (!armedSymbol) return;

      const symbol = armedSymbol;
      const realPrice = getRealPrice(precios, symbol);
      if (!isValidPrice(realPrice)) return;

      // Sin esto la pagina no scrollea al pasar la rueda por encima de la tabla.
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
  }, [precios, isClient, armedSymbol, simOn]);

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

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('simOn', String(simOn));
    }
  }, [simOn, isClient]);

  const handleEdit = (crypto) => {
    setEditando(crypto);
  };

  // Ciclo de tres estados por columna: ascendente -> descendente -> sin
  // orden. El tercer click devuelve las filas al orden guardado. Con el ojo
  // cerrado las columnas de montos no hacen nada.
  const handleSort = (key) => {
    if (!canSortColumn(key, hideBalances)) return;

    setSortConfig(prev => {
      if (prev?.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  // Orden real de las filas a pintar. Arma una fila por cripto con los valores
  // ya resueltos y los pasa al helper, que se encarga de compararlos.
  const visibleOrder = useMemo(() => {
    if (!sortConfig) return cryptoOrder;

    const rows = cryptoOrder.map((symbol) => {
      const row = snapshot.porActivo[symbol] || EMPTY_ROW;
      return {
        symbol,
        amount: row.amount,
        price: row.price,
        percent: getDisplayPercent(symbol, simulaciones, precios),
        value: row.value
      };
    });

    return sortPortfolioRows(rows, sortConfig.key, sortConfig.direction).map(
      (row) => row.symbol
    );
  }, [cryptoOrder, snapshot, sortConfig, simulaciones, precios]);

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

  // Reusa el resolver de la app en vez de repetir la búsqueda a mano. El
  // symbolToId cacheado hace que agregar una cripto que ya se conoce sea una
  // sola llamada (el precio) en vez de dos (búsqueda + precio), y que la
  // búsqueda se payee una unica vez por símbolo.
  const fetchNewCryptoPrice = async (symbol) => {
    const formateados = await resolveAndFetchPrecios([symbol], {
      getCachedMappings: () => JSON.parse(localStorage.getItem('symbolToIdCache') || '{}'),
      saveCachedMappings: (cache) => localStorage.setItem('symbolToIdCache', JSON.stringify(cache))
    });
    return formateados[symbol] || null;
  };

  const handleModalSubmit = async (symbol, amount) => {
    if (modalType === 'add') {
      const newPrice = await fetchNewCryptoPrice(symbol);
      // Si la API no responde (rate limit) se deja el precio anterior como
      // estaba. Antes se seteaba null y la fila quedaba en "Sin precio" de
      // forma permanente, aunque al poll siguiente la API_volara.
      if (newPrice) {
        setPrecios(prev => ({ ...prev, [symbol]: newPrice }));
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

  // Al apagar el interruptor se tira la simulacion entera: quedarian offsets
  // huerfanos aplicados a precios que el usuario ya no ve como editables.
  const handleToggleSim = () => {
    if (simOn) {
      resetSimulacion();
    }
    setSimOn(!simOn);
  };

  // Tocar cualquier celda de la fila la deja seleccionada (verde + cursor):
  // responde a la rueda, al swipe y es la que precarga el modal de + y -.
  // Con la simulacion apagada la fila igual se selecciona, porque + y - la
  // necesitan para precargar el simbolo, pero no se arma para editar precio.
  const handleSelectRow = (symbol) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (!isValidPrice(getRealPrice(precios, symbol))) return;

    setArmedSymbol(symbol);
    if (!simOn) return;
    setSimulaciones(prev => (symbol in prev ? prev : { ...prev, [symbol]: 0 }));
  };

  const handleSwipeStart = (event) => {
    // Cada gesto nuevo arranca limpio: si un swipe anterior no llegó a generar
    // click, el flag quedaba en true y se comía el siguiente toque.
    suppressClickRef.current = false;
    if (event.pointerType === 'mouse') return;
    if (!simOn) return;

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
      <div className="mb-6 sm:mb-8 text-center flex flex-col items-center">
        <h1 className="text-[#00ff00] text-3xl sm:text-4xl font-bold font-mono mb-2 flex items-center gap-1">
          Portfolit
          <button
            onClick={() => setHideBalances(!hideBalances)}
            title={hideBalances ? 'Mostrar montos' : 'Ocultar montos'}
            aria-label={hideBalances ? 'Mostrar montos' : 'Ocultar montos'}
            aria-pressed={hideBalances}
            className="inline-flex items-center hover:text-[#00ff00] transition-colors duration-300"
          >
            <EyeIcon hidden={hideBalances} className="w-8 h-8 sm:w-9 sm:h-9" />
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
            <th
              aria-sort={sortConfig?.key === 'symbol' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className="py-2 sm:py-3 text-left font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[24%]"
            >
              <SortHeader
                label="Crypto"
                columnKey="symbol"
                sortConfig={sortConfig}
                hideBalances={hideBalances}
                onSort={handleSort}
                align="left"
              />
            </th>
            <th
              aria-sort={sortConfig?.key === 'amount' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className="py-2 sm:py-3 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[18%]"
            >
              <SortHeader
                label="Cant."
                columnKey="amount"
                sortConfig={sortConfig}
                hideBalances={hideBalances}
                onSort={handleSort}
              />
            </th>
            <th
              aria-sort={sortConfig?.key === 'price' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className="py-2 sm:py-3 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[20%] whitespace-nowrap"
            >
              <SortHeader
                label="Precio"
                columnKey="price"
                sortConfig={sortConfig}
                hideBalances={hideBalances}
                onSort={handleSort}
              />
            </th>
            <th
              aria-sort={sortConfig?.key === 'percent' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className="py-2 sm:py-3 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[16%] whitespace-nowrap"
            >
              <SortHeader
                label="24hs"
                columnKey="percent"
                sortConfig={sortConfig}
                hideBalances={hideBalances}
                onSort={handleSort}
              />
            </th>
            <th
              aria-sort={sortConfig?.key === 'value' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className="py-2 sm:py-3 text-right font-mono text-[#00ff00]/70 font-normal text-xs sm:text-sm w-[22%]"
            >
              <SortHeader
                label="Total (USD %)"
                columnKey="value"
                sortConfig={sortConfig}
                hideBalances={hideBalances}
                onSort={handleSort}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleOrder.map((crypto) => {
            const row = snapshot.porActivo[crypto] || EMPTY_ROW;
            const { amount, realPrice, price, offset, isSimulated, value, delta } = row;
            const participationPercentage = snapshot.total > 0 ? (value / snapshot.total) * 100 : 0;
            const isUp = offset > 0;
            const isDown = offset < 0;
            const isArmed = armedSymbol === crypto;
            // armedSymbol se setea siempre (lo necesita + y -), pero la fila
            // solo queda "armed" de verdad cuando la simulacion esta encendida.
            const isArmedForSim = isArmed && simOn;
            const enSimulacion = crypto in simulaciones;
            const displayedPercent = getDisplayPercent(crypto, simulaciones, precios);
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
                className={`border-b border-[#00ff00]/10 ${realPrice !== null ? 'sim-row' : ''} ${isArmedForSim || isSimulated ? 'bg-[#00ff00]/10' : ''} transition-colors duration-200`}
              >
                <td className="py-2 sm:py-3 font-mono text-[#00ff00] text-xs sm:text-sm">
                  <span className="inline-flex items-center">
                    <span
                      aria-hidden="true"
                      className={`inline-block w-[7px] ${isArmedForSim ? 'sim-cursor text-[#00ff00]' : 'invisible'}`}
                    >
                      ▌
                    </span>
                    {crypto}
                  </span>
                </td>
                <td className="py-2 sm:py-3 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[56px] sm:min-w-[80px]">
                  <div className="flex items-center justify-end gap-1">
                    <span className="inline-block min-w-[40px] text-right">
                      {hideBalances ? '***' : formatCryptoAmount(amount)}
                    </span>
                  </div>
                </td>
                <td
                  data-symbol={crypto}
                  onPointerDown={simOn ? handleSwipeStart : undefined}
                  onPointerMove={simOn ? handleSwipeMove : undefined}
                  onPointerUp={simOn ? handleSwipeEnd : undefined}
                  onPointerCancel={simOn ? handleSwipeEnd : undefined}
                  title={
                    !simOn
                      ? 'Encendé la simulación para editar este precio'
                      : isArmedForSim
                        ? 'Girá la rueda para ajustar este precio'
                        : 'Click para simular este precio'
                  }
                  className={`py-2 sm:py-3 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[72px] sm:min-w-[84px] relative ${isArmedForSim ? 'sim-price-cell cursor-ns-resize' : ''}`}
                >
                  {isSimulated && (
                    <span
                      aria-hidden="true"
                      className={`sim-float sim-float-${isUp ? 'up' : 'down'} ${simColor}`}
                    >
                      {formatUsd(delta, { signed: true })}
                    </span>
                  )}
                  {price !== null ? (
                    <span className={`inline-block min-w-[64px] sm:min-w-[72px] text-right whitespace-nowrap ${isSimulated ? simGlow : ''}`}>
                      {`$${formatPrice(price)}`}
                    </span>
                  ) : (
                    <span className="inline-block min-w-[64px] sm:min-w-[72px] text-right text-[#00ff00]/50">Sin precio</span>
                  )}
                </td>
                <td
                  className="py-2 sm:py-3 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[52px] sm:min-w-[62px] whitespace-nowrap"
                >
                  {enSimulacion ? (
                    <span className={`inline-block min-w-[48px] sm:min-w-[56px] text-right ${simColor} ${simGlow}`}>
                      {formatPercent(offset)}
                    </span>
                  ) : (
                    <span className={`inline-block min-w-[48px] sm:min-w-[56px] text-right ${
                      displayedPercent === null
                        ? 'text-[#00ff00]/50'
                        : displayedPercent > 0
                          ? 'text-[#00ff00]'
                          : 'text-[#ff0000]'
                    }`}>
                      {displayedPercent === null
                        ? 'N/A'
                        : `${displayedPercent > 0 ? '+' : ''}${displayedPercent.toFixed(2)}%`
                      }
                    </span>
                  )}
                </td>
                <td
                  data-swipe-symbol={isArmedForSim ? crypto : undefined}
                  onPointerDown={isArmedForSim ? handleSwipeStart : undefined}
                  onPointerMove={isArmedForSim ? handleSwipeMove : undefined}
                  onPointerUp={isArmedForSim ? handleSwipeEnd : undefined}
                  onPointerCancel={isArmedForSim ? handleSwipeEnd : undefined}
                  className={`py-2 sm:py-3 text-right font-mono text-[#00ff00] text-xs sm:text-sm min-w-[56px] sm:min-w-[100px] ${isArmedForSim ? 'sim-value-cell' : ''}`}
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
            <td colSpan="4" className="py-2 sm:py-3 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm">
              Total:
            </td>
            <td className="py-2 sm:py-3 text-right font-mono text-[#00ff00] font-bold text-xs sm:text-sm min-w-[64px] sm:min-w-[100px] relative">
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
      <div className="flex items-center justify-between gap-3 sm:gap-4 mt-6 sm:mt-8 px-1 sm:px-2">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="font-mono text-[10px] sm:text-[11px] leading-tight text-center text-[#00ff00]">
            simular
            <br />
            precio
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={simOn}
            aria-label="Simulación de precio"
            title={simOn ? 'Apagar la simulación' : 'Encender la simulación'}
            onClick={handleToggleSim}
            className="sim-toggle"
          >
            <span className="sim-toggle-knob" />
          </button>
        </div>
        <div className="flex items-center gap-5 sm:gap-12">
          <button
            type="button"
            onClick={() => handleOpenModal('add')}
            className="group flex flex-col items-center"
          >
            <span className="text-3xl sm:text-4xl font-light leading-none text-[#00ff00] transition-all duration-300 group-hover:drop-shadow-[0_0_12px_#00ff00]">
              +
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] leading-tight text-center text-[#00ff00]/70 group-hover:text-[#00ff00] transition-colors duration-300">
              agregar
              <br />
              activo
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal('remove')}
            className="group flex flex-col items-center"
          >
            <span className="text-3xl sm:text-4xl font-light leading-none text-[#00ff00] transition-all duration-300 group-hover:drop-shadow-[0_0_12px_#00ff00]">
              −
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] leading-tight text-center text-[#00ff00]/70 group-hover:text-[#00ff00] transition-colors duration-300">
              quitar
              <br />
              activo
            </span>
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