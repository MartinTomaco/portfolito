export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, cryptoSymbol }) {
  if (!isOpen) return null;

  const handleClickOutside = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-overlay"
      onClick={handleClickOutside}
    >
      <div className="bg-black border-2 border-[#00ff00] p-6 rounded-lg w-96 max-w-[90%]">
        <h2 className="text-[#00ff00] text-xl mb-4 font-mono">Eliminar Crypto</h2>
        <p className="text-[#00ff00] mb-6 font-mono">
          ¿Estás seguro que deseas eliminar {cryptoSymbol} de tu portfolio?
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#00ff00] text-[#00ff00] rounded hover:bg-[#00ff00]/10 font-mono transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm(cryptoSymbol);
              onClose();
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-mono transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
} 