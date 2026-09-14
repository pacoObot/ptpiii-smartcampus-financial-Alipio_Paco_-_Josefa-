import React, { useState } from 'react';
import { campusModules } from './modules/catalog';

export function App() {
  const [token, setToken] = useState<string | null>(null);

  const handleMockLogin = () => {
    setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_admin_token');
  };

  return (
    <div className="container">
      {/* Header Bar */}
      <header className="header">
        <div className="brand">
          <div className="brand-badge">UJAC · PTP III</div>
          <div>
            <h1 className="title">Smart Campus Core</h1>
            <p className="subtitle">Plataforma Integrada de Gestao Universitaria — Semana 3</p>
          </div>
        </div>

        <div>
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span className="status-badge status-available">Autenticado (Admin)</span>
              <button className="btn" style={{ background: '#334155' }} onClick={() => setToken(null)}>
                Sair
              </button>
            </div>
          ) : (
            <button className="btn" onClick={handleMockLogin}>
              Entrar (Demonstracao)
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main>
        <section className="glass-card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#f8fafc' }}>
            Modulo do Grupo: Alipio Paco e Jesefa Mutemba
          </h2>
          <p style={{ color: '#94a3b8', lineHeight: '1.6', fontSize: '0.95rem' }}>
            Bem-vindo ao directorio <strong style={{ color: '#60a5fa' }}>SMART CAMPUS</strong>. Este ambiente foi preparado de acordo com as especificacoes da Semana 3 da PTP III (Monolito Modular, Express, Prisma, PostgreSQL, Zod e React).
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <span className="status-badge status-development">Semana 3 · Em Desenvolvimento</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', alignSelf: 'center' }}>
              API Base: <code>http://localhost:4100/api/v1</code>
            </span>
          </div>
        </section>

        <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: '#f1f5f9' }}>
          Catalogo de Modulos da Plataforma
        </h2>

        <div className="grid">
          {campusModules.map((mod) => (
            <div key={mod.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{mod.name}</h3>
                  <span className={`status-badge status-${mod.status}`}>
                    {mod.status === 'available' ? 'Disponivel' : mod.status === 'partial' ? 'Parcial' : 'Desenvolvimento'}
                  </span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.2rem' }}>
                  {mod.description}
                </p>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.8rem' }}>
                  <strong>Equipa:</strong> {mod.teamMembers?.join(', ')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <code style={{ fontSize: '0.75rem', color: '#60a5fa' }}>{mod.route}</code>
                  <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    Explorar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
