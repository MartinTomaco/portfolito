import { useState, useEffect } from 'react';

const symbolToId = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'LTC': 'litecoin'
};

export default function CryptoModal({ isOpen, onClose, onSubmit, type, existingCryptos }) {
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setError('');
      setSymbol('');
      setAmount('');
    }
  }, [isOpen]);

  const handleClickOutside = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!symbol || !amount) {
      setError('Por favor completa todos los campos');
      return;
    }

    const upperSymbol = symbol.toUpperCase();
    
    if (type === 'remove' && !existingCryptos.includes(upperSymbol)) {
      setError('Esta crypto no existe en tu portfolio');
      return;
    }

    if (type === 'add') {
      try {
        const searchResponse = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${symbol}`
        );
        const searchData = await searchResponse.json();
        
        if (searchData.coins.length === 0) {
          setError('Crypto no encontrada en CoinGecko');
          return;
        }
      } catch (error) {
        setError('Error al verificar la crypto');
        return;
      }
    }

    onSubmit(upperSymbol, parseFloat(amount));
    setSymbol('');
    setAmount('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-overlay"
      onClick={handleClickOutside}
    >
      <div className="bg-black border-2 border-[#00ff00] p-6 rounded-lg w-96 max-w-[90%]">
        <h2 className="text-[#00ff00] text-xl mb-4 font-mono">
          {type === 'add' ? 'Agregar Crypto' : 'Quitar Cantidad'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[#00ff00] mb-2 font-mono">Símbolo</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-black border border-[#00ff00] text-[#00ff00] p-2 rounded font-mono"
              list="cryptoList"
              autoComplete="off"
            />
            {type === 'remove' && (
              <datalist id="cryptoList">
                {existingCryptos.map(crypto => (
                  <option key={crypto} value={crypto} />
                ))}
              </datalist>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-[#00ff00] mb-2 font-mono">Cantidad</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black border border-[#00ff00] text-[#00ff00] p-2 rounded font-mono"
              step="any"
              min="0"
            />
          </div>
          {error && (
            <p className="text-red-500 mb-4 font-mono text-sm">{error}</p>
          )}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#00ff00] text-[#00ff00] rounded hover:bg-[#00ff00]/10 font-mono transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#00ff00] text-black rounded hover:bg-[#00ff00]/90 font-mono transition-colors"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 