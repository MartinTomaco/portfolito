'use client';
import { useState, useEffect } from 'react';
import EyeIcon from './EyeIcon';

export default function LoginModal({ onLogin, onGuestLogin, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    alert('La funcionalidad de inicio de sesión estará disponible próximamente. Por favor, continúe como invitado.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar sesión"
      onClick={(e) => {
        if (e.target.classList.contains('modal-overlay')) onClose?.();
      }}
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="relative w-full max-w-md p-6 sm:p-8 border-2 border-[#00ff00] rounded-lg bg-[#0a0a0a]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-2 right-3 text-lg leading-none text-[#00ff00]/50 hover:text-[#00ff00] transition-colors duration-300"
        >
          ×
        </button>

        <h1 className="text-[#00ff00] text-3xl font-mono mb-1 flex items-center justify-center gap-1">
          Portfolit
          <EyeIcon className="w-7 h-7" />
        </h1>
        <p className="text-[#00ff00]/70 text-sm font-mono mb-8 text-center">
          un portfolio cripto simple.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[#00ff00] font-mono text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-[#00ff00] text-[#00ff00] p-2 rounded font-mono opacity-50 cursor-not-allowed"
              disabled
            />
          </div>
          <div>
            <label className="block text-[#00ff00] font-mono text-sm mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-[#00ff00] text-[#00ff00] p-2 rounded font-mono opacity-50 cursor-not-allowed"
              disabled
            />
          </div>
          {error && (
            <p className="text-red-500 font-mono text-sm">{error}</p>
          )}
          <div className="space-y-4">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-[#00ff00]/50 text-black rounded font-mono cursor-not-allowed opacity-50"
              disabled
            >
              Iniciar Sesión (Próximamente)
            </button>
            <button
              type="button"
              onClick={() => onGuestLogin()}
              className="w-full px-4 py-2 border border-[#00ff00] text-[#00ff00] rounded hover:bg-[#00ff00]/10 font-mono transition-colors"
            >
              Continuar como Invitado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
