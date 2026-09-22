import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  Gift,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  ReceiptText,
  Filter,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  Camera,
  Image as ImageIcon,
  Cloud,
  Upload,
  FolderOpen,
  HeartPulse,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const demoAppointments = [
  { time: "08:00", name: "Maria Silva", procedure: "Limpeza de pele", status: "Confirmado" },
  { time: "09:30", name: "Ana Beatriz", procedure: "Microagulhamento", status: "Confirmado" },
  { time: "11:00", name: "Juliana Alves", procedure: "Peeling", status: "Confirmado" },
  { time: "14:00", name: "Carolina Mendes", procedure: "Avaliação facial", status: "Aguardando" },
  { time: "15:30", name: "Larissa Costa", procedure: "Drenagem linfática", status: "Confirmado" },
];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: House },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "clientes", label: "Clientes", icon: UsersRound },
  { id: "evolucao", label: "Evolução", icon: HeartPulse },
  { id: "procedimentos", label: "Procedimentos", icon: Sparkles },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "pacotes", label: "Pacotes", icon: Gift },
  { id: "relatorios", label: "Relatórios", icon: WalletCards },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callback = params.get("google_drive_callback");
    if (!callback) return;

    const success = callback === "success";
    const message = params.get("message") || (success
      ? "Google Drive conectado com sucesso."
      : "Não foi possível conectar o Google Drive.");
    const email = params.get("email") || null;

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          source: "esteticpro-google-drive",
          success,
          message,
          email,
        }, window.location.origin);
      } catch (error) {
        console.error("Erro ao comunicar o retorno do Google Drive:", error);
      }

      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      window.setTimeout(() => window.close(), 500);
    } else {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoadingSession(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loadingSession) return <SplashScreen />;
  if (!session) return <AuthScreen />;
  return <Dashboard session={session} />;
}

function BrandMark({ small = false }) {
  return <img className={`brand-logo ${small ? "small" : ""}`} src="/logo.png" alt="EsteticPro" />;
}

function SplashScreen() {
  return (
    <div className="splash">
      <BrandMark />
      <div className="splash-brand">Estetic<span>Pro</span></div>
      <div className="spinner" />
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    if (!isSupabaseConfigured) {
      setMessage({ type: "error", text: "O Supabase ainda não foi configurado." });
      return;
    }
    if (!email.trim()) return setMessage({ type: "error", text: "Informe seu e-mail." });
    if (password.length < 6) return setMessage({ type: "error", text: "A senha deve ter pelo menos 6 caracteres." });
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        if (!name.trim()) throw new Error("Informe seu nome.");
        if (password !== confirm) throw new Error("As senhas não coincidem.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({ type: "success", text: "Conta criada. Verifique seu e-mail para confirmar o acesso." });
          setMode("login"); setPassword(""); setConfirm("");
        }
      }
    } catch (error) {
      setMessage({ type: "error", text: friendlyAuthError(error.message) });
    } finally { setBusy(false); }
  }

  async function handleForgotPassword() {
    setMessage(null);
    if (!email.trim()) return setMessage({ type: "error", text: "Digite seu e-mail antes de recuperar a senha." });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
    setBusy(false);
    setMessage(error ? { type: "error", text: friendlyAuthError(error.message) } : { type: "success", text: "Enviamos um link de recuperação para seu e-mail." });
  }

  return (
    <main className="auth-page">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="organic-line line-one" /><div className="organic-line line-two" />
      <section className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <h1>Estetic<span>Pro</span></h1>
          <p>SUA ESTÉTICA, MAIS ORGANIZADA</p>
        </div>
        <div className="auth-heading">
          <h2>{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h2>
          <p>{mode === "login" ? "Faça login para acessar o seu painel" : "Comece a organizar sua rotina profissional"}</p>
        </div>
        {message && <div className={`auth-message ${message.type}`}>{message.text}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && <AuthField icon={UserRound} label="Nome completo"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" /></AuthField>}
          <AuthField icon={mode === "login" ? UserRound : UserRound} label="E-mail ou usuário"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" type="email" autoComplete="email" /></AuthField>
          <AuthField icon={null} label="Senha" trailing={<button type="button" className="icon-button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}>
            <span className="field-icon">⌁</span><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </AuthField>
          {mode === "signup" && <AuthField icon={null} label="Confirmar senha"><span className="field-icon">⌁</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" type={showPassword ? "text" : "password"} autoComplete="new-password" /></AuthField>}
          {mode === "login" && <button type="button" className="forgot" onClick={handleForgotPassword}>Esqueceu sua senha?</button>}
          <button className="primary-button" disabled={busy}>{busy ? <span className="button-spinner" /> : mode === "login" ? <>Entrar <ArrowRight size={18} /></> : <>Criar conta <ArrowRight size={18} /></>}</button>
        </form>
        <div className="auth-switch">{mode === "login" ? <>Não tem uma conta? <button onClick={() => { setMode("signup"); setMessage(null); }}>Criar conta</button></> : <>Já possui uma conta? <button onClick={() => { setMode("login"); setMessage(null); }}>Fazer login</button></>}</div>
      </section>
    </main>
  );
}

function AuthField({ icon: Icon, label, trailing, children }) {
  return <label className="field"><span>{label}</span><div className="input-wrap">{Icon ? <Icon size={18} /> : null}{children}{trailing}</div></label>;
}

function friendlyAuthError(message = "") {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Este e-mail já possui uma conta.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return message || "Não foi possível concluir a operação.";
}

function Dashboard({ session }) {
  const [active, setActive] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (mounted) setProfile(data || { full_name: session.user.user_metadata?.full_name || "", avatar_url: null });
    });
    return () => { mounted = false; };
  }, [session.user.id]);

  const displayName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Profissional";
  const go = (id) => { setActive(id); setMobileMenu(false); };
  const logout = async () => { await supabase.auth.signOut(); };

  let content;
  if (active === "dashboard") content = <DashboardHome displayName={displayName} search={search} setSearch={setSearch} onNavigate={go} userId={session.user.id} />;
  else if (active === "clientes") content = <ClientsModule userId={session.user.id} />;
  else if (active === "evolucao") content = <EvolutionModule userId={session.user.id} onNavigate={go} />;
  else if (active === "agenda") content = <AgendaModule userId={session.user.id} />;
  else if (active === "financeiro") content = <FinanceModule userId={session.user.id} />;
  else content = <ComingSoon title={navItems.find((x) => x.id === active)?.label || "Módulo"} onBack={() => go("dashboard")} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="sidebar-brand"><BrandMark small /><div><div className="sidebar-logo">Estetic<span>Pro</span></div><div className="sidebar-tagline">SUA ESTÉTICA, MAIS ORGANIZADA</div></div><button className="mobile-close" onClick={() => setMobileMenu(false)}><X size={20} /></button></div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${active === id ? "active" : ""}`} onClick={() => go(id)}><Icon size={20} strokeWidth={1.6} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-quote"><p>Cuidar da sua pele<br />também é um ato de<br />amor próprio.</p><span /></div>
    </aside>
    {mobileMenu && <button className="sidebar-overlay" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}
    <div className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu size={23} /></button><div className="top-search"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, procedimento..." /></div><div className="top-actions"><button className="notification"><Bell size={20} /><i /></button><div className="profile-mini"><div className="avatar">{initials(displayName)}</div><div><strong>{displayName}</strong><span>Profissional</span></div><ChevronRight size={17} /></div><button className="logout" onClick={logout} title="Sair"><LogOut size={19} /></button></div></header>
      <main className="page-content">{content}</main>
      <nav className="mobile-bottom-nav"><button className={active === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><House size={20} /><span>Início</span></button><button className={active === "agenda" ? "active" : ""} onClick={() => go("agenda")}><CalendarDays size={20} /><span>Agenda</span></button><button className={active === "clientes" ? "active" : ""} onClick={() => go("clientes")}><UsersRound size={20} /><span>Clientes</span></button><button onClick={() => setMobileMenu(true)}><Menu size={20} /><span>Mais</span></button></nav>
    </div>
  </div>;
}

function DashboardHome({ displayName, search, setSearch, onNavigate, userId }) {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [financeSummary, setFinanceSummary] = useState({ receitas: 0, despesas: 0, resultado: 0, ticket: 0 });
  const today = toInputDate(new Date());
  const current = formatCurrentDate();
  const monthKey = today.slice(0, 7);

  useEffect(() => {
    let mounted = true;
    setLoadingAgenda(true);
    supabase.from("appointments").select("id, start_time, procedure_name, status, client_id, clients(full_name)").eq("user_id", userId).eq("appointment_date", today).order("start_time", { ascending: true }).then(({ data, error }) => {
      if (!mounted) return;
      setTodayAppointments((data || []).map((item) => ({ ...item, name: item.clients?.full_name || "Cliente", procedure: item.procedure_name || "Atendimento" })));
      setLoadingAgenda(false);
      if (error) setTodayAppointments([]);
    });
    return () => { mounted = false; };
  }, [userId, today]);

  useEffect(() => {
    let mounted = true;
    const start = `${monthKey}-01`;
    const last = new Date(Number(monthKey.slice(0,4)), Number(monthKey.slice(5,7)), 0).getDate();
    const end = `${monthKey}-${String(last).padStart(2, "0")}`;
    supabase.from("financial_transactions").select("type, amount").eq("user_id", userId).gte("transaction_date", start).lte("transaction_date", end).eq("status", "pago").then(({ data, error }) => {
      if (!mounted || error) return;
      const receitas = (data || []).filter(x => x.type === "receita").reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const despesas = (data || []).filter(x => x.type === "despesa").reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const qtdReceitas = (data || []).filter(x => x.type === "receita").length;
      setFinanceSummary({ receitas, despesas, resultado: receitas - despesas, ticket: qtdReceitas ? receitas / qtdReceitas : 0 });
    });
    return () => { mounted = false; };
  }, [userId, monthKey]);

  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? todayAppointments : todayAppointments.filter((a) => `${a.name} ${a.procedure}`.toLowerCase().includes(term));
  }, [search, todayAppointments]);

  return <>
    <section className="welcome"><div><span>BEM-VINDO DE VOLTA,</span><h1>{displayName}</h1><p>Que hoje seja mais um dia de cuidado,<br className="desktop-only" /> resultados e clientes satisfeitos.</p></div><div className="date-card"><CalendarDays size={23} /><div><span>{current.weekday}</span><strong>{current.date}</strong><p>Uma nova oportunidade para cuidar bem.</p></div></div></section>
    <section className="metrics-grid"><Metric icon={CircleDollarSign} value={money(financeSummary.receitas)} label="Faturamento do mês" trend="Financeiro · lançamentos pagos" /><Metric icon={CalendarDays} value={todayAppointments.length} label="Atendimentos hoje" trend="Agenda em tempo real" /><Metric icon={UsersRound} value="—" label="Novos clientes" trend="Em breve no cadastro" /><Metric icon={Sparkles} value={financeSummary.ticket ? money(financeSummary.ticket) : "R$ 0,00"} label="Ticket médio" trend="Média das receitas pagas" /></section>
    <section className="dashboard-grid">
      <div className="panel schedule-panel"><PanelTitle icon={CalendarDays} title="Agenda de hoje" action="Ver agenda completa" onAction={() => onNavigate("agenda")} /><div className="appointments">{loadingAgenda ? <div className="empty-state">Carregando agenda...</div> : filtered.map((item) => <div className="appointment" key={item.id}><time>{formatTime(item.start_time)}</time><div className="appointment-person"><strong>{item.name}</strong><span>{item.procedure}</span></div><span className={`status ${item.status === "Aguardando" ? "waiting" : ""}`}><i />{item.status}</span><ChevronRight size={18} className="appointment-arrow" /></div>)}{!loadingAgenda && !filtered.length && <div className="empty-state">Nenhum atendimento marcado para hoje.</div>}</div></div>
      <div className="panel finance-panel"><PanelTitle icon={CircleDollarSign} title="Financeiro" action="Abrir" onAction={() => onNavigate("financeiro")} /><div className="finance-content"><div className="donut"><div><strong>{money(financeSummary.resultado)}</strong><span>Resultado do mês</span></div></div><div className="finance-legend"><LegendDot label="Receita" value={money(financeSummary.receitas)} /><LegendDot label="Despesas" value={money(financeSummary.despesas)} /><LegendDot label="Resultado" value={money(financeSummary.resultado)} /></div></div><button className="outline-button" onClick={() => onNavigate("financeiro")}>Abrir Financeiro <ArrowRight size={15} /></button></div>
      <div className="panel quick-panel"><PanelTitle icon={Sparkles} title="Ações rápidas" /><div className="quick-actions"><QuickAction icon={UsersRound} label="Novo cliente" onClick={() => onNavigate("clientes")} /><QuickAction icon={CalendarDays} label="Novo agendamento" onClick={() => onNavigate("agenda")} /><QuickAction icon={Clock3} label="Registro de atendimento" /><QuickAction icon={WalletCards} label="Adicionar despesa" /></div></div>
      <RecentClients onOpen={() => onNavigate("clientes")} />
      <div className="panel returns-panel"><PanelTitle icon={CalendarDays} title="Próximos retornos" action="Agenda" onAction={() => onNavigate("agenda")} /><div className="empty-panel"><CalendarDays size={22} /><span>Os próximos retornos aparecerão aqui conforme a agenda for preenchida.</span><button onClick={() => onNavigate("agenda")}>Abrir agenda <ArrowRight size={14} /></button></div></div>
    </section>
    <footer className="app-footer"><BrandMark small /><span>EsteticPro</span><i /><small>Gestão inteligente para profissionais de estética</small></footer>
  </>;
}

function RecentClients({ onOpen }) {
  const [clients, setClients] = useState([]);
  useEffect(() => { supabase.from("clients").select("id, full_name, created_at").order("created_at", { ascending: false }).limit(4).then(({ data }) => setClients(data || [])); }, []);
  return <div className="panel clients-panel"><PanelTitle icon={UsersRound} title="Clientes recentes" action="Ver todos" onAction={onOpen} />{clients.length ? clients.map((client) => <div className="client-row" key={client.id}><div className="avatar client-avatar">{initials(client.full_name)}</div><div><strong>{client.full_name}</strong><span>Cadastro: {formatDate(client.created_at)}</span></div><em>Ativa</em></div>) : <div className="empty-panel"><UsersRound size={22} /><span>Nenhuma cliente cadastrada ainda.</span><button onClick={onOpen}>Cadastrar primeira cliente <ArrowRight size={14} /></button></div>}</div>;
}

function ClientsModule({ userId }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) setNotice({ type: "error", text: error.message });
    setClients(data || []); setLoading(false);
  }
  useEffect(() => { loadClients(); }, [userId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => `${c.full_name} ${c.phone || ""} ${c.email || ""} ${c.instagram || ""}`.toLowerCase().includes(term));
  }, [clients, query]);

  async function removeClient(client) {
    if (!window.confirm(`Excluir ${client.full_name}? Essa ação não poderá ser desfeita.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", client.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message }); else { setNotice({ type: "success", text: "Cliente excluída com sucesso." }); setSelected(null); loadClients(); }
  }

  function openNew() { setEditing(null); setShowForm(true); setSelected(null); }
  function openEdit(client) { setEditing(client); setShowForm(true); setSelected(null); }

  return <section className="clients-page">
    <div className="module-header"><div><span>GESTÃO DE RELACIONAMENTO</span><h1>Clientes</h1><p>Organize seus clientes, histórico e informações profissionais em um só lugar.</p></div><button className="primary-button module-action" onClick={openNew}><Plus size={18} /> Nova cliente</button></div>
    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <div className="client-toolbar"><div className="client-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, telefone ou e-mail..." /></div><div className="client-count">{filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}</div></div>
    {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando clientes...</div> : filtered.length ? <div className="clients-grid">{filtered.map((client) => <ClientCard key={client.id} client={client} onView={() => setSelected(client)} onEdit={() => openEdit(client)} onDelete={() => removeClient(client)} />)}</div> : <EmptyClients onNew={openNew} hasQuery={Boolean(query)} />}
    {showForm && <ClientForm userId={userId} client={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setNotice({ type: "success", text: editing ? "Cliente atualizada com sucesso." : "Cliente cadastrada com sucesso." }); loadClients(); }} />}
    {selected && <ClientDetails client={selected} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onDelete={() => removeClient(selected)} />}
  </section>;
}

function AgendaModule({ userId }) {
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [view, setView] = useState("day");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const monthRange = useMemo(() => getMonthRange(monthCursor), [monthCursor]);

  async function loadData() {
    setLoading(true);
    const appointmentQuery = view === "month"
      ? supabase
          .from("appointments")
          .select("*, clients(full_name, phone)")
          .eq("user_id", userId)
          .gte("appointment_date", monthRange.start)
          .lte("appointment_date", monthRange.end)
          .order("appointment_date", { ascending: true })
          .order("start_time", { ascending: true })
      : supabase
          .from("appointments")
          .select("*, clients(full_name, phone)")
          .eq("user_id", userId)
          .eq("appointment_date", selectedDate)
          .order("start_time", { ascending: true });

    const [{ data: appts, error: apptError }, { data: clientRows, error: clientError }] = await Promise.all([
      appointmentQuery,
      supabase.from("clients").select("id, full_name, phone, email").eq("user_id", userId).order("full_name", { ascending: true }),
    ]);

    if (apptError) setNotice({ type: "error", text: apptError.message });
    else if (clientError) setNotice({ type: "error", text: clientError.message });

    const normalizedAppointments = (appts || []).map((appointment) => ({
      ...appointment,
      client_name: appointment.clients?.full_name || "Cliente não informado",
      client_phone: appointment.clients?.phone || "",
    }));

    setAppointments(normalizedAppointments);
    setClients(clientRows || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [userId, selectedDate, view, monthRange.start, monthRange.end]);

  const dayLabel = formatLongDate(selectedDate);
  const monthLabel = formatMonthLabel(monthCursor);

  const changeDay = (delta) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    const nextDate = toInputDate(d);
    setSelectedDate(nextDate);
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const changeMonth = (delta) => {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1);
    setMonthCursor(next);
  };

  const goToday = () => {
    const today = new Date();
    setSelectedDate(toInputDate(today));
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  function openMonthDay(date) {
    setSelectedDate(date);
    const d = new Date(`${date}T12:00:00`);
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setView("day");
  }

  async function sendWhatsApp(appointment) {
    if (!appointment.client_id) return setNotice({ type: "error", text: "Este agendamento não possui uma cliente vinculada." });
    setSendingId(appointment.id); setNotice(null);
    const { data, error } = await supabase.functions.invoke("send-whatsapp", { body: { appointment_id: appointment.id } });
    setSendingId(null);
    if (error) return setNotice({ type: "error", text: error.message || "Não foi possível enviar a mensagem." });
    if (data?.error) return setNotice({ type: "error", text: data.error });
    setNotice({ type: "success", text: "Confirmação enviada pelo WhatsApp." });
    loadData();
  }

  async function updateStatus(appointment, status) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message }); else loadData();
  }

  const openNew = (date = selectedDate) => {
    setSelectedDate(date);
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (a) => { setEditing(a); setShowForm(true); };

  return <section className="agenda-page">
    <div className="module-header agenda-header">
      <div><span>GESTÃO DE AGENDA</span><h1>Agenda</h1><p>Organize seus atendimentos e mantenha suas clientes informadas.</p></div>
      <button className="primary-button module-action" onClick={() => openNew()}><Plus size={18} /> Novo agendamento</button>
    </div>
    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}

    <div className="agenda-view-switcher" role="tablist" aria-label="Visualização da agenda">
      <button className={view === "day" ? "active" : ""} onClick={() => setView("day")}><Clock3 size={15} /> Dia</button>
      <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}><CalendarDays size={15} /> Mês</button>
    </div>

    {view === "day" ? <>
      <div className="agenda-toolbar">
        <button className="secondary-button" onClick={() => changeDay(-1)} aria-label="Dia anterior"><ArrowLeft size={16} /></button>
        <div className="agenda-date"><CalendarDays size={18} /><div><strong>{dayLabel.weekday}</strong><span>{dayLabel.full}</span></div></div>
        <button className="secondary-button" onClick={() => changeDay(1)} aria-label="Próximo dia"><ArrowRight size={16} /></button>
        <button className="secondary-button today-button" onClick={goToday}>Hoje</button>
      </div>
      {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando agenda...</div> : appointments.length ? <div className="agenda-list">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onEdit={() => openEdit(appointment)} onStatus={(status) => updateStatus(appointment, status)} onWhatsApp={() => sendWhatsApp(appointment)} sending={sendingId === appointment.id} />)}</div> : <div className="empty-clients agenda-empty"><div className="empty-icon"><CalendarDays size={32} /></div><h2>Agenda livre</h2><p>Não há atendimentos marcados para {dayLabel.full}. Crie um agendamento para começar.</p><button className="primary-button compact" onClick={() => openNew()}><Plus size={17} /> Novo agendamento</button></div>}
    </> : <>
      <div className="agenda-month-toolbar">
        <div className="agenda-month-navigation">
          <button className="secondary-button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ArrowLeft size={16} /></button>
          <div className="agenda-month-title"><CalendarDays size={18} /><strong>{monthLabel}</strong></div>
          <button className="secondary-button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ArrowRight size={16} /></button>
        </div>
        <button className="secondary-button today-button" onClick={goToday}>Hoje</button>
      </div>
      {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando calendário...</div> : <MonthCalendar monthCursor={monthCursor} appointments={appointments} selectedDate={selectedDate} onSelectDay={openMonthDay} onNew={openNew} onEdit={openEdit} />}
    </>}

    {showForm && <AppointmentForm userId={userId} clients={clients} appointment={editing} defaultDate={selectedDate} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setNotice({ type: "success", text: editing ? "Agendamento atualizado." : "Agendamento criado com sucesso." }); loadData(); }} />}
  </section>;
}

function MonthCalendar({ monthCursor, appointments, selectedDate, onSelectDay, onNew, onEdit }) {
  const cells = useMemo(() => getMonthCalendarCells(monthCursor), [monthCursor]);
  const today = toInputDate(new Date());
  const appointmentsByDate = useMemo(() => appointments.reduce((acc, appointment) => {
    if (!acc[appointment.appointment_date]) acc[appointment.appointment_date] = [];
    acc[appointment.appointment_date].push(appointment);
    return acc;
  }, {}), [appointments]);

  return <div className="month-calendar-wrap">
    <div className="month-calendar">
      <div className="month-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <div key={day}>{day}</div>)}</div>
      <div className="month-grid">
        {cells.map((cell) => {
          const dayAppointments = appointmentsByDate[cell.date] || [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          return <div key={cell.date} className={`month-cell ${cell.inMonth ? "in-month" : "outside-month"} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}>
            <button className="month-day-number" onClick={() => onSelectDay(cell.date)}>{cell.day}</button>
            <div className="month-cell-actions"><button onClick={() => onNew(cell.date)} aria-label={`Novo agendamento em ${cell.date}`}><Plus size={12} /></button></div>
            <div className="month-events">
              {dayAppointments.slice(0, 3).map((appointment) => <button key={appointment.id} className={`month-event status-${slugify(appointment.status || "Agendado")}`} onClick={() => onEdit(appointment)} title={`${formatTime(appointment.start_time)} · ${appointment.client_name}`}>
                <span>{formatTime(appointment.start_time)}</span><strong>{appointment.client_name}</strong>
              </button>)}
              {dayAppointments.length > 3 && <button className="month-more" onClick={() => onSelectDay(cell.date)}>+ {dayAppointments.length - 3} atendimentos</button>}
            </div>
          </div>;
        })}
      </div>
    </div>
  </div>;
}

function AppointmentCard({ appointment, onEdit, onStatus, onWhatsApp, sending }) {
  const status = appointment.status || "Agendado";
  return <article className="appointment-card">
    <div className="appointment-time"><strong>{formatTime(appointment.start_time)}</strong><span>{appointment.end_time ? `até ${formatTime(appointment.end_time)}` : ""}</span></div>
    <div className="appointment-main"><div className="appointment-client"><div className="large-avatar">{initials(appointment.client_name || "Cliente")}</div><div><h3>{appointment.client_name || "Cliente não informado"}</h3><p>{appointment.procedure_name || "Atendimento"}</p></div></div><span className={`status status-${slugify(status)}`}>{status}</span></div>
    <div className="appointment-actions">
      <button className="whatsapp-button" onClick={onWhatsApp} disabled={sending} title="Enviar confirmação pelo WhatsApp"><MessageCircle size={15} />{sending ? "Enviando..." : "WhatsApp"}</button>
      <select value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status do agendamento"><option>Agendado</option><option>Confirmado</option><option>Aguardando</option><option>Concluído</option><option>Cancelado</option><option>Faltou</option></select>
      <button className="icon-action" onClick={onEdit} title="Editar"><Edit3 size={15} /></button>
    </div>
    {appointment.notes && <div className="appointment-note"><span>Observação</span>{appointment.notes}</div>}
  </article>;
}

function AppointmentForm({ userId, clients, appointment, defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    client_id: appointment?.client_id || "",
    appointment_date: appointment?.appointment_date || defaultDate,
    start_time: appointment?.start_time || "09:00",
    end_time: appointment?.end_time || "10:00",
    procedure_name: appointment?.procedure_name || "",
    status: appointment?.status || "Agendado",
    notes: appointment?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.client_id) return setError("Selecione uma cliente.");
    if (!form.appointment_date || !form.start_time) return setError("Informe a data e o horário do atendimento.");
    setSaving(true);
    const payload = {
      client_id: form.client_id,
      appointment_date: form.appointment_date,
      start_time: form.start_time,
      end_time: form.end_time || null,
      procedure_name: form.procedure_name.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const result = appointment
      ? await supabase.from("appointments").update(payload).eq("id", appointment.id).eq("user_id", userId)
      : await supabase.from("appointments").insert({ ...payload, user_id: userId });
    setSaving(false);
    if (result.error) setError(result.error.message); else onSaved();
  }

  return <div className="modal-backdrop"><div className="modal-card appointment-modal"><div className="modal-header"><div><span>AGENDA PROFISSIONAL</span><h2>{appointment ? "Editar agendamento" : "Novo agendamento"}</h2></div><button onClick={onClose}><X size={20} /></button></div><form onSubmit={submit} className="client-form">
    <label className="form-input"><span>Cliente *</span><select value={form.client_id} onChange={(e) => set("client_id", e.target.value)}><option value="">Selecione uma cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}{client.phone ? ` • ${client.phone}` : ""}</option>)}</select></label>
    <div className="form-grid"><FormInput label="Data *" value={form.appointment_date} onChange={(v) => set("appointment_date", v)} type="date" /><FormInput label="Procedimento" value={form.procedure_name} onChange={(v) => set("procedure_name", v)} placeholder="Ex.: Limpeza de pele" /><FormInput label="Horário inicial *" value={form.start_time} onChange={(v) => set("start_time", v)} type="time" /><FormInput label="Horário final" value={form.end_time} onChange={(v) => set("end_time", v)} type="time" /></div>
    <label className="form-input"><span>Status</span><select value={form.status} onChange={(e) => set("status", e.target.value)}><option>Agendado</option><option>Confirmado</option><option>Aguardando</option><option>Concluído</option><option>Cancelado</option><option>Faltou</option></select></label>
    <label className="textarea-field"><span>Observações</span><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex.: cliente pediu atenção especial em determinada área..." rows="4" /></label>
    <div className="whatsapp-info"><MessageCircle size={18} /><div><strong>Confirmação por WhatsApp</strong><p>Depois de salvar, você poderá enviar a confirmação diretamente para o número cadastrado na ficha da cliente.</p></div></div>
    {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <span className="button-spinner" /> : <><Check size={17} /> {appointment ? "Salvar alterações" : "Criar agendamento"}</>}</button></div>
  </form></div></div>;
}

function ClientCard({ client, onView, onEdit, onDelete }) {
  return <article className="client-card"><button className="client-card-main" onClick={onView}><div className="large-avatar">{initials(client.full_name)}</div><div className="client-card-info"><h3>{client.full_name}</h3><span>{client.phone || "Telefone não informado"}</span><small>{client.email || "E-mail não informado"}</small></div><ChevronRight size={18} /></button><div className="client-card-footer"><span>Cliente desde {formatDate(client.created_at)}</span><div><button onClick={onEdit} title="Editar"><Edit3 size={16} /></button><button className="danger-button" onClick={onDelete} title="Excluir"><Trash2 size={16} /></button></div></div></article>;
}

function EmptyClients({ onNew, hasQuery }) {
  return <div className="empty-clients"><div className="empty-icon"><UsersRound size={32} /></div><h2>{hasQuery ? "Nenhuma cliente encontrada" : "Comece sua base de clientes"}</h2><p>{hasQuery ? "Tente buscar por outro nome, telefone ou e-mail." : "Cadastre sua primeira cliente para começar a construir o histórico profissional."}</p>{!hasQuery && <button className="primary-button compact" onClick={onNew}><Plus size={17} /> Cadastrar primeira cliente</button>}</div>;
}

const emptyClient = { full_name: "", phone: "", email: "", birth_date: "", cpf: "", instagram: "", address: "", notes: "" };

function ClientForm({ userId, client, onClose, onSaved }) {
  const [form, setForm] = useState(client ? { ...emptyClient, ...client } : { ...emptyClient });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.full_name.trim()) return setError("Informe o nome completo da cliente.");
    setSaving(true);
    const payload = { full_name: form.full_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, birth_date: form.birth_date || null, cpf: form.cpf.trim() || null, instagram: form.instagram.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null };
    const result = client
      ? await supabase.from("clients").update(payload).eq("id", client.id).eq("user_id", userId)
      : await supabase.from("clients").insert({ ...payload, user_id: userId });
    setSaving(false);
    if (result.error) setError(result.error.message); else onSaved();
  }
  return <div className="modal-backdrop"><div className="modal-card client-form-modal"><div className="modal-header"><div><span>CADASTRO DE CLIENTE</span><h2>{client ? "Editar cliente" : "Nova cliente"}</h2></div><button onClick={onClose}><X size={20} /></button></div><form onSubmit={submit} className="client-form"><FormInput label="Nome completo *" value={form.full_name} onChange={(v) => set("full_name", v)} placeholder="Ex.: Maria Silva" /><div className="form-grid"><FormInput label="Telefone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="(00) 00000-0000" /><FormInput label="E-mail" value={form.email} onChange={(v) => set("email", v)} placeholder="cliente@email.com" type="email" /><FormInput label="Data de nascimento" value={form.birth_date || ""} onChange={(v) => set("birth_date", v)} type="date" /><FormInput label="CPF" value={form.cpf} onChange={(v) => set("cpf", v)} placeholder="000.000.000-00" /><FormInput label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} placeholder="@usuario" /></div><FormInput label="Endereço" value={form.address} onChange={(v) => set("address", v)} placeholder="Rua, número, bairro..." /><label className="textarea-field"><span>Observações</span><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Informações importantes sobre a cliente..." rows="4" /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <span className="button-spinner" /> : <><Check size={17} /> {client ? "Salvar alterações" : "Cadastrar cliente"}</>}</button></div></form></div></div>;
}

function FormInput({ label, value, onChange, placeholder, type = "text" }) {
  return <label className="form-input"><span>{label}</span><input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function ClientDetails({ client, onClose, onEdit, onDelete }) {
  return <div className="modal-backdrop"><div className="modal-card details-modal"><div className="modal-header"><div><span>PERFIL DA CLIENTE</span><h2>{client.full_name}</h2></div><button onClick={onClose}><X size={20} /></button></div><div className="details-hero"><div className="large-avatar">{initials(client.full_name)}</div><div><strong>{client.phone || "Telefone não informado"}</strong><span>{client.email || "E-mail não informado"}</span><small>Cliente desde {formatDate(client.created_at)}</small></div></div><div className="details-grid"><DetailItem label="Data de nascimento" value={formatDate(client.birth_date)} /><DetailItem label="CPF" value={client.cpf} /><DetailItem label="Instagram" value={client.instagram} /><DetailItem label="Endereço" value={client.address} /></div><div className="details-note"><span>Observações</span><p>{client.notes || "Nenhuma observação registrada."}</p></div><div className="modal-actions"><button className="secondary-button danger-outline" onClick={onDelete}><Trash2 size={16} /> Excluir</button><button className="primary-button" onClick={onEdit}><Edit3 size={16} /> Editar cliente</button></div></div></div>;
}

function DetailItem({ label, value }) { return <div><span>{label}</span><strong>{value || "Não informado"}</strong></div>; }

function Metric({ icon: Icon, value, label, trend }) { return <article className="metric-card"><div className="metric-icon"><Icon size={19} /></div><strong>{value}</strong><span>{label}</span><small>↑ &nbsp;{trend}</small></article>; }
function PanelTitle({ icon: Icon, title, action, onAction }) { return <div className="panel-title"><div><Icon size={18} /><h3>{title}</h3></div>{action && <button onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>; }
function LegendDot({ label, value }) { return <div className="legend-item"><i /><span>{label}</span><strong>{value}</strong></div>; }
function QuickAction({ icon: Icon, label, onClick }) { return <button className="quick-action" onClick={onClick}><Icon size={21} /><span>{label}</span></button>; }

function FinanceModule({ userId }) {
  const [month, setMonth] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("todos");

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month).replace(/^./, c => c.toUpperCase());
  const start = `${monthKey}-01`;
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = `${monthKey}-${String(endDate.getDate()).padStart(2, "0")}`;

  const loadTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("id, type, description, category, amount, transaction_date, payment_method, status, client_id, notes, clients(full_name)")
      .eq("user_id", userId)
      .gte("transaction_date", start)
      .lte("transaction_date", end)
      .order("transaction_date", { ascending: false });
    if (!error) setTransactions(data || []);
    else console.error(error);
    setLoading(false);
  };

  useEffect(() => { loadTransactions(); }, [userId, monthKey]);

  const totals = useMemo(() => {
    const receitas = transactions.filter(t => t.type === "receita").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const despesas = transactions.filter(t => t.type === "despesa").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return { receitas, despesas, resultado: receitas - despesas };
  }, [transactions]);

  const filtered = filter === "todos" ? transactions : transactions.filter(t => t.type === filter);

  const changeMonth = (delta) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = value => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));

  const saveTransaction = async (payload) => {
    const clean = { ...payload, user_id: userId, amount: Number(String(payload.amount).replace(",", ".")) };
    const query = editing
      ? supabase.from("financial_transactions").update(clean).eq("id", editing.id).eq("user_id", userId)
      : supabase.from("financial_transactions").insert(clean);
    const { error } = await query;
    if (error) return alert(error.message);
    setShowForm(false); setEditing(null); loadTransactions();
  };

  const removeTransaction = async (id) => {
    if (!window.confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id).eq("user_id", userId);
    if (error) alert(error.message); else loadTransactions();
  };

  return <main className="page-content finance-page">
    <div className="module-header">
      <div><span className="eyebrow">GESTÃO FINANCEIRA</span><h1>Financeiro</h1><p>Acompanhe receitas, despesas e o resultado da sua estética.</p></div>
      <button className="primary-button module-action" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={17} /> Novo lançamento</button>
    </div>

    <div className="finance-month-toolbar">
      <button className="secondary-button" onClick={() => changeMonth(-1)}><ArrowLeft size={16} /></button>
      <div className="finance-month"><span>{monthLabel}</span></div>
      <button className="secondary-button" onClick={() => changeMonth(1)}><ArrowRight size={16} /></button>
      <button className="secondary-button finance-today" onClick={() => setMonth(new Date())}>Hoje</button>
    </div>

    <section className="finance-metrics">
      <div className="finance-metric"><div className="finance-metric-icon income"><TrendingUp size={19} /></div><span>Receitas</span><strong>{money(totals.receitas)}</strong><small>No mês selecionado</small></div>
      <div className="finance-metric"><div className="finance-metric-icon expense"><TrendingDown size={19} /></div><span>Despesas</span><strong>{money(totals.despesas)}</strong><small>No mês selecionado</small></div>
      <div className="finance-metric highlight"><div className="finance-metric-icon result"><Wallet size={19} /></div><span>Resultado</span><strong>{money(totals.resultado)}</strong><small>Receitas − despesas</small></div>
    </section>

    <section className="panel finance-transactions-panel">
      <div className="panel-title finance-list-header"><div><ReceiptText size={18} /><h3>Lançamentos</h3></div><div className="finance-filters"><Filter size={14} /><button className={filter === "todos" ? "active" : ""} onClick={() => setFilter("todos")}>Todos</button><button className={filter === "receita" ? "active" : ""} onClick={() => setFilter("receita")}>Receitas</button><button className={filter === "despesa" ? "active" : ""} onClick={() => setFilter("despesa")}>Despesas</button></div></div>
      {loading ? <div className="finance-empty">Carregando lançamentos...</div> : filtered.length === 0 ? <div className="finance-empty"><Wallet size={28} /><strong>Nenhum lançamento neste mês</strong><span>Registre uma receita ou despesa para começar a acompanhar o resultado.</span><button className="outline-button" onClick={() => setShowForm(true)}><Plus size={15} /> Adicionar lançamento</button></div> : <div className="transaction-list">
        {filtered.map(t => <div className="transaction-row" key={t.id}>
          <div className={`transaction-icon ${t.type}`}><CheckCircle2 size={17} /></div>
          <div className="transaction-main"><strong>{t.description}</strong><span>{t.category || "Sem categoria"}{t.clients?.full_name ? ` · ${t.clients.full_name}` : ""}</span></div>
          <div className="transaction-date">{date(t.transaction_date)}</div>
          <div className="transaction-method">{t.payment_method || "—"}</div>
          <strong className={`transaction-amount ${t.type}`}>{t.type === "receita" ? "+" : "−"} {money(t.amount)}</strong>
          <div className="transaction-actions"><button className="icon-action" title="Editar" onClick={() => { setEditing(t); setShowForm(true); }}><Edit3 size={15} /></button><button className="icon-action danger" title="Excluir" onClick={() => removeTransaction(t.id)}><Trash2 size={15} /></button></div>
        </div>)}
      </div>}
    </section>

    {showForm && <TransactionModal transaction={editing} userId={userId} onClose={() => { setShowForm(false); setEditing(null); }} onSave={saveTransaction} />}
  </main>;
}

function TransactionModal({ transaction, userId, onClose, onSave }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    type: transaction?.type || "receita", description: transaction?.description || "", category: transaction?.category || "", amount: transaction?.amount ?? "", transaction_date: transaction?.transaction_date || toInputDate(new Date()), payment_method: transaction?.payment_method || "Pix", status: transaction?.status || "pago", client_id: transaction?.client_id || "", notes: transaction?.notes || ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.from("clients").select("id, full_name").eq("user_id", userId).order("full_name").then(({ data }) => setClients(data || [])); }, [userId]);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async e => { e.preventDefault(); if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) return alert("Informe descrição e valor válido."); setSaving(true); await onSave({ ...form, client_id: form.client_id || null }); setSaving(false); };

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal-card finance-modal">
    <div className="modal-header"><div><span className="eyebrow">FINANCEIRO</span><h2>{transaction ? "Editar lançamento" : "Novo lançamento"}</h2></div><button className="icon-action" onClick={onClose}><X size={18} /></button></div>
    <form onSubmit={submit}>
      <div className="finance-type-toggle"><button type="button" className={form.type === "receita" ? "active receita" : ""} onClick={() => set("type", "receita")}><TrendingUp size={16} /> Receita</button><button type="button" className={form.type === "despesa" ? "active despesa" : ""} onClick={() => set("type", "despesa")}><TrendingDown size={16} /> Despesa</button></div>
      <div className="form-grid">
        <label className="form-field"><span>Descrição *</span><input className="form-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Ex.: Limpeza de pele" /></label>
        <label className="form-field"><span>Valor *</span><input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0,00" /></label>
        <label className="form-field"><span>Data *</span><input className="form-input" type="date" value={form.transaction_date} onChange={e => set("transaction_date", e.target.value)} /></label>
        <label className="form-field"><span>Categoria</span><select className="form-input" value={form.category} onChange={e => set("category", e.target.value)}><option value="">Selecione</option>{(form.type === "receita" ? ["Procedimento","Pacote","Produto","Outros"] : ["Produtos","Aluguel","Materiais","Marketing","Equipamentos","Taxas","Outros"]).map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="form-field"><span>Forma de pagamento</span><select className="form-input" value={form.payment_method} onChange={e => set("payment_method", e.target.value)}>{["Pix","Dinheiro","Cartão de crédito","Cartão de débito","Transferência","Outro"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="form-field"><span>Cliente</span><select className="form-input" value={form.client_id} onChange={e => set("client_id", e.target.value)}><option value="">Nenhuma</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
        <label className="form-field full"><span>Observações</span><textarea className="form-input" rows="3" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações do lançamento..." /></label>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Salvando..." : transaction ? "Salvar alterações" : "Registrar lançamento"}</button></div>
    </form>
  </div></div>;
}


function EvolutionModule({ userId, onNavigate }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [evolutions, setEvolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [drive, setDrive] = useState({ connected: false, email: null });
  const [showForm, setShowForm] = useState(false);
  const [editingEvolution, setEditingEvolution] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    procedure_name: "",
    evolution_date: toInputDate(new Date()),
    notes: "",
    products_used: "",
    recommendations: "",
  });
  const [files, setFiles] = useState({ antes: [], depois: [], adicional: [] });

  async function getAuthenticatedUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const authenticatedUserId = data?.user?.id;
    if (!authenticatedUserId) throw new Error("Sua sessão expirou. Faça login novamente.");
    return authenticatedUserId;
  }

  async function loadClients() {
    setClientsLoading(true);
    setClientsError("");
    try {
      // A RLS do Supabase já restringe os resultados ao profissional autenticado.
      // Não dependemos do userId recebido pelo componente para evitar divergência de sessão.
      await getAuthenticatedUserId();
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, photo_url, created_at")
        .order("full_name", { ascending: true });

      if (error) throw error;

      const rows = data || [];
      setClients(rows);
      setSelectedClientId((current) => {
        if (current && rows.some((client) => client.id === current)) return current;
        return rows[0]?.id || "";
      });

      if (!rows.length) {
        setClientsError("Nenhuma cliente cadastrada. Cadastre uma cliente em Clientes para registrar uma evolução.");
      }
    } catch (error) {
      console.error("Erro ao carregar clientes para Evolução:", error);
      setClients([]);
      setSelectedClientId("");
      setClientsError(error?.message || "Não foi possível carregar suas clientes.");
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadDriveStatus() {
    try {
      const authenticatedUserId = await getAuthenticatedUserId();
      const { data, error } = await supabase
        .from("google_drive_connections")
        .select("google_account_email, root_folder_id")
        .eq("user_id", authenticatedUserId)
        .maybeSingle();

      if (error) throw error;

      setDrive({
        connected: Boolean(data),
        email: data?.google_account_email || null,
      });
    } catch (error) {
      console.error("Erro ao carregar conexão Google Drive:", error);
      // Se a tabela ainda não estiver acessível, não bloqueamos a tela de evolução.
      setDrive({ connected: false, email: null });
    }
  }

  async function loadEvolutions(clientId = selectedClientId) {
    if (!clientId) {
      setEvolutions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_evolutions")
        .select("*, evolution_photos(*)")
        .eq("client_id", clientId)
        .order("evolution_date", { ascending: false });

      if (error) throw error;
      setEvolutions(data || []);
    } catch (error) {
      console.error("Erro ao carregar evoluções:", error);
      setEvolutions([]);
      setNotice({ type: "error", text: error?.message || "Não foi possível carregar as evoluções." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
    loadDriveStatus();

    const handleFocus = () => {
      loadClients();
      loadDriveStatus();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [userId]);

  useEffect(() => {
    loadEvolutions(selectedClientId);
  }, [selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  function openNew() {
    if (!selectedClientId) {
      setNotice({
        type: "error",
        text: clients.length
          ? "Selecione uma cliente antes de iniciar uma evolução."
          : "Nenhuma cliente cadastrada. Cadastre uma cliente em Clientes primeiro.",
      });
      return;
    }

    setEditingEvolution(null);
    setForm({
      procedure_name: "",
      evolution_date: toInputDate(new Date()),
      notes: "",
      products_used: "",
      recommendations: "",
    });
    setFiles({ antes: [], depois: [], adicional: [] });
    setShowForm(true);
  }

  function openEdit(evolution) {
    setEditingEvolution(evolution);
    setSelectedClientId(evolution.client_id);
    setForm({
      procedure_name: evolution.procedure_name || "",
      evolution_date: evolution.evolution_date || toInputDate(new Date()),
      notes: evolution.notes || "",
      products_used: evolution.products_used || "",
      recommendations: evolution.recommendations || "",
    });
    setFiles({ antes: [], depois: [], adicional: [] });
    setShowForm(true);
    setNotice(null);
  }

  async function connectDrive() {
    let popup = null;
    let timeoutId = null;
    let pollId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (pollId) window.clearInterval(pollId);
      window.removeEventListener("message", handleMessage);
    };

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "esteticpro-google-drive") return;

      cleanup();

      if (event.data.success) {
        setDrive({
          connected: true,
          email: event.data.email || null,
        });
        setNotice({
          type: "success",
          text: event.data.message || "Google Drive conectado com sucesso.",
        });
        loadDriveStatus();
      } else {
        setNotice({
          type: "error",
          text: event.data.message || "Não foi possível conectar o Google Drive.",
        });
      }
    };

    try {
      setNotice(null);
      popup = window.open(
        "about:blank",
        "esteticpro-google-drive",
        "width=620,height=760,left=180,top=70,resizable=yes,scrollbars=yes"
      );

      if (!popup) {
        throw new Error("O navegador bloqueou a janela de autorização. Permita pop-ups para o EsteticPro e tente novamente.");
      }

      popup.document.write(`
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>EsteticPro · Google Drive</title>
        <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07110d;color:#f7f1e5;font-family:Arial,sans-serif;text-align:center}.box{padding:32px;max-width:360px}.spinner{width:34px;height:34px;margin:0 auto 20px;border:3px solid rgba(216,181,106,.2);border-top-color:#d8b56a;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}h2{margin:0 0 8px;font-family:Georgia,serif;font-weight:500}p{margin:0;color:#aebbb3;line-height:1.5}</style></head>
        <body><div class="box"><div class="spinner"></div><h2>Conectando Google Drive</h2><p>Preparando a autorização segura...</p></div></body></html>
      `);
      popup.document.close();

      window.addEventListener("message", handleMessage);

      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "start" },
      });

      if (error) {
        let message = error.message || "Não foi possível iniciar a conexão com o Google Drive.";
        try {
          if (error.context?.body) {
            const body = await error.context.json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}
        throw new Error(message);
      }

      const authorizationUrl = data?.authorization_url || data?.url;
      if (!authorizationUrl) throw new Error("A função do Google Drive respondeu sem uma URL de autorização.");

      popup.location.href = authorizationUrl;
      popup.focus();

      pollId = window.setInterval(() => {
        if (popup?.closed) cleanup();
      }, 1000);

      timeoutId = window.setTimeout(() => {
        cleanup();
        if (popup && !popup.closed) popup.close();
        setNotice({ type: "error", text: "A conexão com o Google Drive demorou mais que o esperado. Tente novamente." });
      }, 5 * 60 * 1000);
    } catch (e) {
      cleanup();
      if (popup && !popup.closed) popup.close();
      setNotice({ type: "error", text: e?.message || "Não foi possível conectar o Google Drive." });
    }
  }

  function pickFiles(type, event) {
    const selected = Array.from(event.target.files || []);
    setFiles((prev) => ({ ...prev, [type]: [...prev[type], ...selected] }));
    event.target.value = "";
  }

  function removePicked(type, index) {
    setFiles((prev) => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  }

  async function saveEvolution(e) {
    e.preventDefault();
    if (!selectedClientId) return setNotice({ type: "error", text: "Selecione uma cliente." });
    if (!form.procedure_name.trim()) return setNotice({ type: "error", text: "Informe o procedimento." });

    const uploads = Object.entries(files).flatMap(([type, list]) => list.map((file) => ({ type, file })));

    if (!drive.connected && uploads.length) {
      return setNotice({ type: "error", text: "Conecte o Google Drive antes de enviar as fotos." });
    }

    const invalidFile = uploads.find(({ file }) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalidFile) return setNotice({ type: "error", text: "Use apenas imagens JPG, PNG ou WEBP." });

    const oversized = uploads.find(({ file }) => file.size > 15 * 1024 * 1024);
    if (oversized) return setNotice({ type: "error", text: "Cada imagem deve ter no máximo 15 MB." });

    setSaving(true);
    setNotice(null);

    try {
      const authenticatedUserId = await getAuthenticatedUserId();

      const clean = {
        user_id: authenticatedUserId,
        client_id: selectedClientId,
        procedure_name: form.procedure_name.trim(),
        evolution_date: form.evolution_date,
        notes: form.notes.trim() || null,
        products_used: form.products_used.trim() || null,
        recommendations: form.recommendations.trim() || null,
      };

      let evolution = editingEvolution;

      if (editingEvolution) {
        const { data, error } = await supabase
          .from("client_evolutions")
          .update(clean)
          .eq("id", editingEvolution.id)
          .eq("user_id", authenticatedUserId)
          .select()
          .single();

        if (error) throw error;
        evolution = data;
      } else {
        const { data, error } = await supabase
          .from("client_evolutions")
          .insert(clean)
          .select()
          .single();

        if (error) throw error;
        evolution = data;
      }

      for (const item of uploads) {
        const body = new FormData();
        body.append("evolution_id", evolution.id);
        body.append("photo_type", item.type);
        body.append("file", item.file, item.file.name);

        const { data: uploadData, error: uploadError } =
          await supabase.functions.invoke("google-drive-upload", { body });

        if (uploadError) {
          let message = uploadError.message || "Não foi possível enviar uma das fotos.";
          try {
            if (uploadError.context?.body) {
              const raw = await uploadError.context.text();
              try {
                const responseBody = JSON.parse(raw);
                if (responseBody?.error) message = responseBody.error;
              } catch {
                if (raw) message = raw;
              }
            }
          } catch (_) {}
          throw new Error(message);
        }

        if (uploadData?.error) throw new Error(uploadData.error);
      }

      setShowForm(false);
      setEditingEvolution(null);
      setFiles({ antes: [], depois: [], adicional: [] });
      setNotice({
        type: "success",
        text: editingEvolution
          ? (uploads.length ? "Evolução atualizada e novas fotos salvas com sucesso." : "Evolução atualizada com sucesso.")
          : (uploads.length ? "Evolução e fotos salvas com sucesso." : "Evolução salva com sucesso.")
      });
      await loadEvolutions(selectedClientId);
    } catch (e) {
      console.error("Erro ao salvar evolução:", e);
      setNotice({ type: "error", text: e?.message || "Não foi possível salvar a evolução." });
    } finally {
      setSaving(false);
    }
  }

  return <section className="evolution-page">
    <div className="module-header">
      <div><span>HISTÓRICO ESTÉTICO</span><h1>Evolução</h1><p>Registre procedimentos e acompanhe a evolução visual das suas clientes.</p></div>
      <button className="primary-button module-action" onClick={openNew}><Plus size={18} /> Nova evolução</button>
    </div>

    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}

    <section className="drive-connect-card">
      <div className="drive-connect-icon"><Cloud size={22} /></div>
      <div className="drive-connect-copy"><strong>Google Drive</strong><span>{drive.connected ? `Conectado: ${drive.email || "sua conta Google"}` : "As fotos de evolução serão armazenadas no seu Google Drive privado."}</span></div>
      <button className={drive.connected ? "secondary-button" : "primary-button"} onClick={connectDrive}><Cloud size={16} /> {drive.connected ? "Reconectar" : "Conectar Google Drive"}</button>
    </section>

    <div className="evolution-client-toolbar">
      <div className="evolution-client-select">
        <UsersRound size={17} />
        <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} disabled={clientsLoading}>
          <option value="">{clientsLoading ? "Carregando clientes..." : clients.length ? "Selecione uma cliente" : "Nenhuma cliente cadastrada"}</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
        </select>
      </div>
      {clients.length > 0 && <div className="evolution-client-quick-list">
        {clients.slice(0, 8).map((client) => <button key={client.id} type="button" className={selectedClientId === client.id ? "active" : ""} onClick={() => setSelectedClientId(client.id)}>{initials(client.full_name)}<span>{client.full_name}</span></button>)}
      </div>}
      {clientsError && <button type="button" className="secondary-button" onClick={loadClients}>Recarregar clientes</button>}
      {selectedClient && <div className="evolution-client-pill"><div className="avatar client-avatar">{initials(selectedClient.full_name)}</div><div><strong>{selectedClient.full_name}</strong><span>{evolutions.length} {evolutions.length === 1 ? "evolução registrada" : "evoluções registradas"}</span></div></div>}
    </div>

    {clientsError && <div className="module-notice error"><span>{clientsError}</span><button onClick={() => setClientsError("")}><X size={16} /></button></div>}

    {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando evoluções...</div> : !selectedClientId ? <div className="evolution-empty"><HeartPulse size={30} /><strong>{clients.length ? "Selecione uma cliente" : "Sua base de clientes está vazia"}</strong><span>{clients.length ? "Escolha uma cliente para visualizar ou registrar sua evolução." : "Cadastre uma cliente para começar a registrar evoluções."}</span>{!clients.length && onNavigate && <button className="outline-button" onClick={() => onNavigate("clientes")}><UsersRound size={15} /> Ir para Clientes</button>}</div> : evolutions.length === 0 ? <div className="evolution-empty"><Camera size={30} /><strong>Nenhuma evolução registrada</strong><span>Comece registrando o primeiro procedimento e suas fotos Antes e Depois.</span><button className="outline-button" onClick={openNew}><Plus size={15} /> Registrar primeira evolução</button></div> : <div className="evolution-timeline">{evolutions.map((evolution) => <EvolutionCard key={evolution.id} evolution={evolution} onEdit={openEdit} />)}</div>}

    {showForm && <EvolutionFormModal form={form} setForm={setForm} files={files} onPick={pickFiles} onRemove={removePicked} onClose={() => { setShowForm(false); setEditingEvolution(null); }} onSubmit={saveEvolution} saving={saving} driveConnected={drive.connected} clientName={selectedClient?.full_name} editing={Boolean(editingEvolution)} existingPhotos={editingEvolution?.evolution_photos || []} />}
  </section>;
}

function EvolutionCard({ evolution, onEdit }) {
  const photos = evolution.evolution_photos || [];
  const before = photos.find(p => p.photo_type === "antes");
  const after = photos.find(p => p.photo_type === "depois");
  const extra = photos.filter(p => p.photo_type === "adicional");
  return <article className="evolution-card">
    <div className="evolution-card-head">
      <div><span>{formatDate(evolution.evolution_date)}</span><h3>{evolution.procedure_name}</h3></div>
      <div className="evolution-card-head-actions">
        <div className="evolution-badge"><HeartPulse size={13} /> Evolução</div>
        <button type="button" className="icon-action" title="Editar evolução" onClick={() => onEdit(evolution)}><Edit3 size={15} /></button>
      </div>
    </div>
    <div className="evolution-comparison"><DrivePhoto photo={before} label="Antes" /><div className="evolution-arrow">→</div><DrivePhoto photo={after} label="Depois" /></div>
    {extra.length > 0 && <div className="evolution-extra-grid">{extra.map(photo => <DrivePhoto key={photo.id} photo={photo} label="Foto adicional" small />)}</div>}
    {(evolution.notes || evolution.products_used || evolution.recommendations) && <div className="evolution-notes">
      {evolution.notes && <div><strong>Observações</strong><p>{evolution.notes}</p></div>}
      {evolution.products_used && <div><strong>Produtos utilizados</strong><p>{evolution.products_used}</p></div>}
      {evolution.recommendations && <div><strong>Recomendações / retorno</strong><p>{evolution.recommendations}</p></div>}
    </div>}
  </article>;
}

function DrivePhoto({ photo, label, small = false }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    async function loadPhoto() {
      if (!photo?.drive_file_id) {
        setSrc("");
        setError("");
        return;
      }

      setSrc("");
      setError("");

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "google-drive-media",
          { body: { file_id: photo.drive_file_id } }
        );

        if (fnError) {
          let message = fnError.message || "Não foi possível carregar a imagem.";
          try {
            if (fnError.context?.json) {
              const responseBody = await fnError.context.json();
              if (responseBody?.error) message = responseBody.error;
            }
          } catch (_) {}
          throw new Error(message);
        }

        if (!(data instanceof Blob)) {
          throw new Error("A imagem foi recebida em um formato inesperado.");
        }

        objectUrl = URL.createObjectURL(data);
        if (!cancelled) setSrc(objectUrl);
      } catch (e) {
        if (!cancelled) {
          console.error("Erro ao carregar foto da evolução:", e);
          setError(e?.message || "Imagem indisponível.");
        }
      }
    }

    loadPhoto();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo?.drive_file_id]);

  return (
    <div className={`drive-photo ${small ? "small" : ""}`}>
      <span>{label}</span>
      {src ? (
        <img src={src} alt={label} loading="lazy" />
      ) : (
        <div className="drive-photo-placeholder" title={error || "Carregando..."}>
          {error ? <FolderOpen size={20} /> : <ImageIcon size={20} />}
          <small>{error ? "Não foi possível carregar" : "Carregando..."}</small>
        </div>
      )}
    </div>
  );
}

function EvolutionFormModal({ form, setForm, files, onPick, onRemove, onClose, onSubmit, saving, driveConnected, clientName, editing, existingPhotos }) {
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const fileBlock = (type, title, icon) => <div className="photo-upload-block"><div className="photo-upload-head"><div><strong>{title}</strong><span>{type === "adicional" ? "Opcional" : "Recomendado"}</span></div>{icon}</div><label className="photo-dropzone"><Upload size={20} /><strong>Adicionar fotos</strong><small>JPG, PNG ou WEBP</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => onPick(type, e)} /></label>{files[type].length > 0 && <div className="picked-files">{files[type].map((file, i) => <div key={`${file.name}-${i}`}><span>{file.name}</span><button type="button" onClick={() => onRemove(type, i)}><X size={13} /></button></div>)}</div>}</div>;
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal-card evolution-modal">
    <div className="modal-header"><div><span className="eyebrow">EVOLUÇÃO · {clientName || "CLIENTE"}</span><h2>{editing ? "Editar evolução" : "Novo registro"}</h2></div><button className="icon-action" onClick={onClose}><X size={18} /></button></div>{editing && existingPhotos?.length > 0 && <div className="form-info">As fotos já salvas permanecem no Google Drive. Você pode adicionar novas fotos abaixo.</div>}
    {!driveConnected && <div className="drive-warning"><Cloud size={18} /><span>O Google Drive ainda não está conectado. Você pode salvar o registro sem fotos, mas precisará conectar o Drive para enviar imagens.</span></div>}
    <form onSubmit={onSubmit}>
      <div className="form-grid"><label className="form-field"><span>Procedimento *</span><input className="form-input" value={form.procedure_name} onChange={e => set("procedure_name", e.target.value)} placeholder="Ex.: Limpeza de pele" /></label><label className="form-field"><span>Data *</span><input className="form-input" type="date" value={form.evolution_date} onChange={e => set("evolution_date", e.target.value)} /></label><label className="form-field full"><span>Observações</span><textarea className="form-input" rows="3" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Descreva o procedimento e observações da evolução..." /></label><label className="form-field full"><span>Produtos utilizados</span><textarea className="form-input" rows="2" value={form.products_used} onChange={e => set("products_used", e.target.value)} placeholder="Produtos, ativos ou protocolos utilizados..." /></label><label className="form-field full"><span>Recomendações / retorno</span><textarea className="form-input" rows="2" value={form.recommendations} onChange={e => set("recommendations", e.target.value)} placeholder="Cuidados, orientações e data sugerida para retorno..." /></label></div>
      <div className="photo-upload-grid">{fileBlock("antes", "Foto Antes", <Camera size={17} />)}{fileBlock("depois", "Foto Depois", <Camera size={17} />)}{fileBlock("adicional", "Fotos adicionais", <ImageIcon size={17} />)}</div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <span className="button-spinner" /> : <><Check size={16} /> Salvar evolução</>}</button></div>
    </form>
  </div></div>;
}

function ComingSoon({ title, onBack }) { return <div className="coming-soon"><BrandMark /><span>Módulo</span><h1>{title}</h1><p>Esta área está preparada na navegação. A próxima etapa será conectar este módulo aos fluxos reais do EsteticPro.</p><button className="primary-button compact" onClick={onBack}><ArrowLeft size={17} /> Voltar ao Dashboard</button></div>; }
function getMonthRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1, 12);
  const end = new Date(year, month + 1, 0, 12);
  return { start: toInputDate(start), end: toInputDate(end) };
}
function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date).replace(/^./, (c) => c.toUpperCase());
}
function getMonthCalendarCells(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  const mondayIndex = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayIndex + last.getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, index) => {
    const cellDate = new Date(date.getFullYear(), date.getMonth(), 1 + index - mondayIndex, 12);
    return {
      date: toInputDate(cellDate),
      day: cellDate.getDate(),
      inMonth: cellDate.getMonth() === date.getMonth(),
    };
  });
}
function toInputDate(date) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {}); return `${parts.year}-${parts.month}-${parts.day}`; }
function formatLongDate(value) { const date = new Date(`${value}T12:00:00`); return { weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date).replace(/^./, (c) => c.toUpperCase()), full: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date) }; }
function formatTime(value) { return value ? String(value).slice(0, 5) : "--:--"; }
function slugify(value = "") { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"); }

function formatCurrentDate() { const now = new Date(); return { weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(now).replace(/^./, (c) => c.toUpperCase()), date: new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(now) }; }
function formatDate(value) { if (!value) return "Não informado"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function initials(name = "") { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "EP"; }

export default App;
