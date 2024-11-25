import { useState } from 'react';

export default function LoginPage({ onLogin, onGuestLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    alert('La funcionalidad de inicio de sesión estará disponible próximamente. Por favor, continúe como invitado.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-md p-6 border-2 border-[#00ff00] rounded-lg">
        <h1 className="text-[#00ff00] text-3xl font-mono mb-8 text-center">Portfolito</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[#00ff00] font-mono mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-[#00ff00] text-[#00ff00] p-2 rounded font-mono opacity-50 cursor-not-allowed"
              disabled
            />
          </div>
          <div>
            <label className="block text-[#00ff00] font-mono mb-2">Contraseña</label>
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