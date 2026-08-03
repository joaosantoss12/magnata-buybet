import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'
 
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const TELEGRAM_CLIENT_ID = import.meta.env.VITE_TELEGRAM_CLIENT_ID as string

interface Pick {
  game: string
  bet: string
  odd: string
  analysis: string
  markets: string
  price: string | number
  active: boolean
}

interface PickSnapshot {
  id: string
  game: string
  bet: string
  odd: string
  analysis: string
  markets: string
  image_url: string | null
  paid_at: string
}

type TgUser = {
  username?: string
  first_name: string
  photo_url?: string
}

type TelegramAuthData = { id_token?: string; error?: string }

declare global {
  interface Window {
    onTelegramAuth?: (data: TelegramAuthData) => void
  }
}

// ── Telegram login widget: injects oauth.telegram.org's script next to a
// button it turns into the login trigger. This site has its own dedicated
// bot (TELEGRAM_CLIENT_ID) — its domain must be registered with @BotFather
// under that bot's Web Login settings for the widget to render.
function TelegramLoginWidget() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const script = document.createElement('script')
    script.src = 'https://oauth.telegram.org/js/telegram-login.js?22'
    script.async = true
    script.setAttribute('data-client-id', TELEGRAM_CLIENT_ID)
    script.setAttribute('data-onauth', 'onTelegramAuth(data)')
    script.setAttribute('data-request-access', 'write')
    el.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  return (
    <div ref={containerRef} className="tg-login-widget">
      <button className="tg-auth-button" data-style="shine" type="button">
        Entrar com Telegram
      </button>
    </div>
  )
}

function PickCard({ pick }: { pick: PickSnapshot }) {
  return (
    <div className="email-preview">
      <div className="email-row">
        <span className="email-label">Jogo</span>
        <span>{pick.game}</span>
      </div>
      <div className="email-row">
        <span className="email-label">Aposta</span>
        <span className="pick-highlight">{pick.bet}</span>
      </div>
      <div className="email-row">
        <span className="email-label">Odd</span>
        <span className="odd-value">{pick.odd}</span>
      </div>
      {pick.analysis && (
        <div className="email-analysis">
          <span className="email-label">Análise</span>
          <p>{pick.analysis}</p>
        </div>
      )}
      {pick.markets && (
        <div className="email-analysis">
          <span className="email-label">Mercados Alternativos</span>
          <p>{pick.markets}</p>
        </div>
      )}
      {pick.image_url && (
        <img src={pick.image_url} alt="Bilhete da aposta" className="pick-image" />
      )}
    </div>
  )
}

function SuccessPage({ tgUser }: { tgUser: TgUser | null }) {
  const purchaseId = new URLSearchParams(window.location.search).get('purchase_id')
  const [status, setStatus] = useState<
    'checking' | 'pending' | 'ready' | 'forbidden' | 'not_found' | 'logged_out' | 'error'
  >('checking')
  const [pick, setPick] = useState<PickSnapshot | null>(null)
  const attemptsRef = useRef(0)

  const poll = useCallback(async () => {
    if (!purchaseId) {
      setStatus('error')
      return
    }
    try {
      const res = await fetch(`/api/purchase-status?id=${encodeURIComponent(purchaseId)}`)
      const data = await res.json()
      setStatus(data.status)
      if (data.status === 'ready') setPick(data.pick)
    } catch {
      setStatus('error')
    }
  }, [purchaseId])

  useEffect(() => {
    poll()
    const interval = setInterval(() => {
      attemptsRef.current += 1
      if (attemptsRef.current > 20 || status !== 'checking' && status !== 'pending') {
        clearInterval(interval)
        return
      }
      poll()
    }, 3000)
    return () => clearInterval(interval)
  }, [poll, status])

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon">✓</div>
        <h1>Pagamento Confirmado!</h1>

        {status === 'checking' || status === 'pending' ? (
          <>
            <span className="spinner-gold" />
            <p>A preparar a tua aposta...</p>
            <p className="success-sub">Isto demora normalmente só alguns segundos.</p>
          </>
        ) : status === 'ready' && pick ? (
          <>
            <p>Aqui está a tua análise e aposta recomendada:</p>
            <PickCard pick={pick} />
            <p className="success-sub">
              Podes voltar a este site e iniciar sessão com o mesmo Telegram sempre que
              quiseres consultar as tuas apostas compradas.
            </p>
          </>
        ) : status === 'logged_out' || status === 'forbidden' ? (
          <>
            <p>
              Inicia sessão com o <strong>mesmo Telegram</strong> que usaste na compra para
              veres a tua aposta.
            </p>
            {!tgUser && <TelegramLoginWidget />}
          </>
        ) : (
          <>
            <p>Não encontrámos essa compra.</p>
            <p className="success-sub">
              Se acabaste de pagar, tenta recarregar a página. Caso contrário contacta
              magnataapostas@gmail.com
            </p>
          </>
        )}

        <a href="/" className="btn-primary">
          Voltar ao Início
        </a>
      </div>
    </div>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-question" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className="faq-icon">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="faq-answer">{answer}</p>}
    </div>
  )
}

function TelegramAuthBar({
  tgUser,
  onLogout,
}: {
  tgUser: TgUser | null
  onLogout: () => void
}) {
  if (tgUser) {
    return (
      <div className="tg-auth-bar">
        {tgUser.photo_url && (
          <img src={tgUser.photo_url} alt={tgUser.first_name} referrerPolicy="no-referrer" className="tg-avatar" />
        )}
        <div className="tg-auth-info">
          <span className="tg-auth-name">{tgUser.first_name}</span>
          {tgUser.username && <span className="tg-auth-username">@{tgUser.username}</span>}
        </div>
        <button className="tg-logout-btn" onClick={onLogout} type="button">
          Sair
        </button>
      </div>
    )
  }

  return (
    <div className="tg-auth-bar tg-auth-bar-login">
      <p>
        <strong>Inicia sessão com o Telegram</strong> antes de comprar — assim a tua aposta
        fica disponível aqui no site depois do pagamento, sem depender do email.
      </p>
      <TelegramLoginWidget />
    </div>
  )
}

function MyPurchases({ purchases }: { purchases: PickSnapshot[] }) {
  if (!purchases.length) return null
  return (
    <section className="section my-purchases">
      <div className="container container-sm">
        <p className="section-tag">A tua conta</p>
        <h2 className="section-title">As Tuas Apostas Compradas</h2>
        <div className="my-purchases-list">
          {purchases.map((p) => (
            <PickCard key={p.id} pick={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pick, setPick] = useState<Pick>()
  const [tgUser, setTgUser] = useState<TgUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [myPurchases, setMyPurchases] = useState<PickSnapshot[]>([])
  const isSuccess = new URLSearchParams(window.location.search).get('success') === '1'

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram-me')
      const data = await res.json()
      setTgUser(data.loggedIn ? data.user : null)
    } finally {
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    // Registers the callback the telegram-login.js embed calls on auth. Must
    // be defined unconditionally — the library evals `onTelegramAuth(data)`
    // in global scope.
    window.onTelegramAuth = async (data: TelegramAuthData) => {
      if (!data.id_token) {
        setError('Login com Telegram falhou. Tenta novamente.')
        return
      }
      const res = await fetch('/api/telegram-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: data.id_token }),
      })
      if (!res.ok) {
        setError('Login com Telegram falhou. Tenta novamente.')
        return
      }
      await refreshAuth()
    }
  }, [refreshAuth])

  const logout = useCallback(async () => {
    await fetch('/api/telegram-logout', { method: 'POST' })
    setTgUser(null)
    setMyPurchases([])
  }, [])

  useEffect(() => {
    if (isSuccess) window.scrollTo(0, 0)
  }, [isSuccess])

  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  useEffect(() => {
    supabase
      .from('picks')
      .select('*')
      .eq('seller', 'magnata')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setPick(data)
      })
  }, [])

  useEffect(() => {
    if (isSuccess || !authChecked || !tgUser) return
    fetch('/api/my-purchases')
      .then((res) => res.json())
      .then((data) => setMyPurchases(data.purchases ?? []))
      .catch(() => setMyPurchases([]))
  }, [isSuccess, authChecked, tgUser])

  const PRICE = pick ? `${Number(pick.price).toFixed(2)}€` : '99.99€'
  const disabledReason = !tgUser ? 'Inicia sessão com o Telegram para comprar' : undefined

  if (isSuccess) return <SuccessPage tgUser={tgUser} />

  const handleBuy = async () => {
    if (!tgUser) {
      document.getElementById('tg-auth-bar')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Erro ao processar o pagamento. Tenta novamente.')
      }
    } catch {
      setError('Não foi possível ligar ao servidor. Tenta mais tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      {/* ── Background Image ── */}
      <div className="bg-image" />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-icon">⚽</span>
            <span className="logo-text">
              Magnata <span className="logo-highlight">Apostas</span>
            </span>
          </div>
          <button
            className="btn-nav"
            onClick={handleBuy}
            disabled={loading || pick?.active === false}
            title={disabledReason}
          >
            Comprar — {PRICE}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🏆 Análises Desportivas Premium</div>
          <h1 className="hero-title">
            A Aposta Certa,
            <br />
            <span className="gradient-text">Na Hora Certa.</span>
          </h1>
          <p className="hero-sub">
            Recebe a nossa análise detalhada e aposta recomendada diretamente aqui no site,
            logo após o pagamento. Sem subscrições. Sem complicações.
          </p>

          <div id="tg-auth-bar">
            <TelegramAuthBar tgUser={tgUser} onLogout={logout} />
          </div>

          <div className="hero-actions">
            <button
              className="btn-primary btn-large"
              onClick={handleBuy}
              disabled={loading || pick?.active === false}
              title={disabledReason}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <span>Comprar Aposta</span>
                  <span className="btn-price">{PRICE}</span>
                </>
              )}
            </button>
            <p className="hero-guarantee">
              🔒 Pagamento seguro via Stripe · Entrega imediata no site
            </p>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-bar">
        <div className="stats-inner">
          <div className="stat">
            <span className="stat-num">82%</span>
            <span className="stat-label">Taxa de Sucesso</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">1500+</span>
            <span className="stat-label">Apostadores Satisfeitos</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">5+</span>
            <span className="stat-label">Anos de Experiência</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">⚡</span>
            <span className="stat-label">Entrega Imediata</span>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section how">
        <div className="container">
          <p className="section-tag">Simples e rápido</p>
          <h2 className="section-title">Como Funciona?</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">Passo [1]</div>
              <div className="step-icon">📲</div>
              <h3>Entras com o Telegram</h3>
              <p>Login rápido e seguro, sem passwords, com a tua conta de Telegram.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-num">Passo [2]</div>
              <div className="step-icon">💳</div>
              <h3>Compras a Análise</h3>
              <p>Um pagamento único de {PRICE} via Stripe. Seguro e rápido.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-num">Passo [3]</div>
              <div className="step-icon">🎯</div>
              <h3>Vês a Aposta no Site</h3>
              <p>
                A análise detalhada e aposta recomendada aparecem aqui mesmo, logo após o
                pagamento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="section what">
        <div className="container">
          <div className="what-grid">
            <div className="what-text">
              <p className="section-tag">O que inclui</p>
              <h2 className="section-title">Tudo o que Precisas</h2>
              <p className="what-sub">
                Não perdes tempo a analisar estatísticas, históricos e odds.
                Nós fazemos isso por ti.
              </p>
              <ul className="what-list">
                {[
                  'Análise completa do jogo',
                  'Aposta recomendada com odd',
                  'Fundamentação e raciocínio da aposta',
                  'Mercados alternativos sugeridos',
                  'Disponível no site em segundos',
                  'Sem subscrição — pagas só quando queres',
                ].map((item) => (
                  <li key={item}>
                    <span className="check">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="what-card">
              <div className="card-header">
                <span className="card-tag">EXEMPLO DE APOSTA</span>
              </div>
              <div className="card-body">
                <div className="email-preview">
                  <div className="email-row">
                    <span className="email-label">Jogo</span>
                    <span>Manchester City vs Liverpool</span>
                  </div>
                  <div className="email-row">
                    <span className="email-label">Aposta</span>
                    <span className="pick-highlight">Ambas as Equipas Marcam</span>
                  </div>
                  <div className="email-row">
                    <span className="email-label">Odd</span>
                    <span className="odd-value">1.85</span>
                  </div>
                  <div className="email-analysis">
                    <span className="email-label">Análise</span>
                    <p>Ambas as equipas chegam em grande forma ofensiva. O City leva 8 jogos consecutivos a marcar em casa, enquanto o Liverpool não fechou a baliza fora nas últimas 6 deslocações. Esperamos um jogo aberto com golos dos dois lados.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="section pricing" id="pricing">
        <div className="container">
          <p className="section-tag">Preço justo</p>
          <h2 className="section-title">Um Preço, Zero Surpresas</h2>
          <div className="price-card-wrap">
            <div className="price-card">
              <div className="price-badge">COMPRA ÚNICA</div>
              <div className="price-amount">
                <span className="price-curr">€</span>
                <span className="price-num">{pick ? Number(pick.price).toFixed(2).split('.')[0] : '14'}</span>
                <span className="price-dec">.{pick ? Number(pick.price).toFixed(2).split('.')[1] : '99'}</span>
              </div>
              <p className="price-desc">
                Paga uma vez. Recebe a análise. Sem renovações automáticas.
              </p>
              <ul className="price-features">
                {[
                  'Análise completa no site',
                  'Aposta recomendada com odd',
                  'Entrega imediata após pagamento',
                  'Sem subscrição obrigatória',
                ].map((f) => (
                  <li key={f}>
                    <span className="check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="btn-primary btn-full"
                onClick={handleBuy}
                disabled={loading || pick?.active === false}
                title={disabledReason}
              >
                {loading ? <span className="spinner" /> : `Comprar por ${PRICE}`}
              </button>
              <p className="price-secure">🔒 Pagamento 100% seguro via Stripe</p>
              {error && <p className="error-msg">{error}</p>}
            </div>
          </div>
        </div>
      </section>

      <MyPurchases purchases={myPurchases} />

      {/* ── FAQ ── */}
      <section className="section faq">
        <div className="container container-sm">
          <p className="section-tag">Dúvidas frequentes</p>
          <h2 className="section-title">FAQ</h2>
          <div className="faq-list">
            <FAQItem
              question="Preciso mesmo de ter Telegram?"
              answer="Sim. O login com Telegram é o que nos permite mostrar-te a aposta aqui no site depois do pagamento e deixá-la disponível para quando quiseres voltar a consultá-la — sem depender de emails que às vezes se perdem no spam."
            />
            <FAQItem
              question="Quando vejo a análise após o pagamento?"
              answer="Assim que o pagamento é confirmado, a análise aparece automaticamente nesta página, geralmente em poucos segundos."
            />
            <FAQItem
              question="O pagamento é seguro?"
              answer="Sim. Utilizamos o Stripe, um dos processadores de pagamentos mais seguros do mundo. Os teus dados bancários nunca passam pelos nossos servidores."
            />
            <FAQItem
              question="Posso comprar várias análises?"
              answer="Claro! Cada compra é individual. Podes comprar sempre que quiseres uma nova análise, e todas ficam guardadas na tua conta de Telegram."
            />
            <FAQItem
              question="Consigo voltar a ver uma aposta que já paguei?"
              answer="Sim — inicia sessão com o mesmo Telegram que usaste na compra e vais encontrar todas as tuas apostas compradas nesta página."
            />
            <FAQItem
              question="Têm política de reembolso?"
              answer="Dado o caráter digital e imediato do produto, não fazemos reembolsos após a entrega da análise. Em caso de problemas técnicos, entra em contacto."
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="logo">
            <span className="logo-icon">⚽</span>
            <span className="logo-text">
              Magnata <span className="logo-highlight">Apostas</span>
            </span>
          </div>
          <p className="footer-disclaimer">
            ⚠️ Apostar pode criar dependência. Joga com responsabilidade. +18.
            As análises são de caráter informativo e não garantem resultados.
          </p>
          <p className="footer-copy">
            © {new Date().getFullYear()} Magnata Apostas. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
