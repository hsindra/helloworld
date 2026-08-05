'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Usuário ou senha inválidos.');
        return;
      }
      // Reload completo (não router.push) pra garantir que o cookie recém
      // gravado já valha na primeira request feita pela página seguinte.
      window.location.href = '/';
    } catch {
      setError('Falha de rede ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <h1>CifraX</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading || !username || !password}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
