import { useState, useEffect, useMemo, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Trash2,
  Archive,
  RefreshCw,
  LogOut,
  Search,
  Filter,
  AlertCircle,
  Database,
  Calendar,
  CheckCircle,
  Inbox,
  Sparkles,
  Info,
  CircleAlert
} from 'lucide-react';

import { GmailMessage, InboxStats } from './types';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import {
  listGmailMessages,
  batchGetGmailMessages,
  batchModifyGmailMessages,
  getGmailUserProfile,
} from './lib/gmail';
import ConfirmModal from './components/ConfirmModal';
import StatsPanel from './components/StatsPanel';
import SenderAnalysis from './components/SenderAnalysis';

export default function App() {
  // Auth state
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  // App state
  const [profile, setProfile] = useState<{ emailAddress: string; messagesTotal: number } | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'senders'>('list');

  // Error/Success Notification
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter Presets & Limits
  const [maxResults, setMaxResults] = useState<number>(80);
  const [activeFilterId, setActiveFilterId] = useState<string>('newsletter');
  const [customQuery, setCustomQuery] = useState('');
  const [isCustomQueryActive, setIsCustomQueryActive] = useState(false);

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    itemCount: number;
    itemsList: string[];
    actionType: 'trash' | 'archive' | 'read';
    targetIds: string[];
    isDestructive: boolean;
  }>({
    title: '',
    description: '',
    itemCount: 0,
    itemsList: [],
    actionType: 'trash',
    targetIds: [],
    isDestructive: true,
  });

  // Filter definitions
  const filterPresets = useMemo(() => [
    {
      id: 'newsletter',
      name: 'Iscrizioni & Newsletter',
      description: "Email promozionali o che contengono dicitura d'iscrizione",
      query: 'label:INBOX (category:promotions OR unsubscribe OR disiscriviti)',
      icon: Mail,
    },
    {
      id: 'large',
      name: 'Voluminose (> 5MB)',
      description: 'Email pesanti che occupano lo spazio di Google Drive',
      query: 'label:INBOX larger:5M',
      icon: Database,
    },
    {
      id: 'old',
      name: 'Molto Vecchie (> 1 Anno)',
      description: 'Email ricevute più di 12 mesi fa ancora in Inbox',
      query: 'label:INBOX older_than:1y',
      icon: Calendar,
    },
    {
      id: 'unread',
      name: 'Non Lette (Inbox)',
      description: 'Messaggi non aperti presenti in Inbox',
      query: 'label:INBOX is:unread',
      icon: Search,
    },
    {
      id: 'inbox',
      name: 'Tutta la Posta (Inbox)',
      description: 'Tutta la posta presente nella cartella in Arrivo',
      query: 'label:INBOX',
      icon: Inbox,
    },
  ], []);

  // Determine current active query based on filter
  const currentQuery = useMemo(() => {
    if (isCustomQueryActive) {
      return customQuery || 'label:INBOX';
    }
    const preset = filterPresets.find((p) => p.id === activeFilterId);
    return preset ? preset.query : 'label:INBOX';
  }, [activeFilterId, isCustomQueryActive, customQuery, filterPresets]);

  // Handle automatic Auth listener state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, tokenString) => {
        setUser(currentUser);
        setToken(tokenString);
        setNeedsAuth(false);
        setAuthLoading(false);
        // Load default profile and messages once user is found
        loadUserProfile(tokenString);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch or refresh emails list
  const loadMessagesOfQuery = async (authToken: string, overrideQuery?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setLoadingProgress(null);
    setSelectedIds(new Set());

    const targetQuery = overrideQuery || currentQuery;

    try {
      const summaries = await listGmailMessages(authToken, targetQuery, maxResults);
      
      if (summaries.length === 0) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      const details = await batchGetGmailMessages(
        authToken,
        summaries,
        (loaded, total) => {
          setLoadingProgress({ loaded, total });
        }
      );

      setMessages(details);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setErrorMsg(`Errore nel caricamento delle email: ${err.message || err}`);
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  };

  // Profile data loader
  const loadUserProfile = async (authToken: string) => {
    try {
      const profileData = await getGmailUserProfile(authToken);
      setProfile(profileData);
      // Automatically load the default "newsletter" category once signed in
      loadMessagesOfQuery(authToken, filterPresets[0].query);
    } catch (err) {
      console.warn('Could not load user profile details:', err);
    }
  };

  // Handle direct Google Sign-In
  const handleLogin = async () => {
    setErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        loadUserProfile(result.accessToken);
      }
    } catch (err: any) {
      console.error('Signin error:', err);
      setErrorMsg(`Accesso non riuscito: ${err.message || err}`);
    }
  };

  // Log out handler
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setProfile(null);
      setMessages([]);
      setSelectedIds(new Set());
      setNeedsAuth(true);
    } catch (err: any) {
      setErrorMsg(`Tentativo di disconnessione fallito: ${err.message}`);
    }
  };

  // Auto trigger message reload if filter presets changes
  const handlePresetSelect = (filterId: string) => {
    if (!token) return;
    setIsCustomQueryActive(false);
    setActiveFilterId(filterId);
    
    // Find preset and fetch instantly
    const preset = filterPresets.find((p) => p.id === filterId);
    if (preset) {
      loadMessagesOfQuery(token, preset.query);
    }
  };

  // Custom search submit
  const handleCustomQuerySearch = (e: FormEvent) => {
    e.preventDefault();
    if (!token || !customQuery.trim()) return;
    setIsCustomQueryActive(true);
    loadMessagesOfQuery(token, customQuery);
  };

  // Compute stats on the CURRENT analyzed list
  const computedStats = useMemo(() => {
    const stats: InboxStats = {
      totalAnalyzed: messages.length,
      totalUnread: 0,
      totalNewsletters: 0,
      totalLarge: 0,
      totalOld: 0,
      totalSize: 0,
    };

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const msg of messages) {
      stats.totalSize += msg.sizeEstimate;
      if (msg.isUnread) stats.totalUnread += 1;
      if (msg.hasUnsubscribe || msg.labelIds.includes('CATEGORY_PROMOTIONS')) {
        stats.totalNewsletters += 1;
      }
      if (msg.sizeEstimate > 5 * 1024 * 1024) {
        stats.totalLarge += 1;
      }

      // Safe date parse
      try {
        const msgDate = new Date(msg.date);
        if (msgDate < oneYearAgo) {
          stats.totalOld += 1;
        }
      } catch (e) {
        // Safe skip
      }
    }

    return stats;
  }, [messages]);

  // Clientside filtered items matching local search bar
  const clientFilteredMessages = useMemo(() => {
    if (!searchFilter.trim()) return messages;
    const filterLower = searchFilter.toLowerCase();
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(filterLower) ||
        m.fromName.toLowerCase().includes(filterLower) ||
        m.fromEmail.toLowerCase().includes(filterLower) ||
        m.snippet.toLowerCase().includes(filterLower)
    );
  }, [messages, searchFilter]);

  // Multi-selection managers
  const handleToggleSelectOne = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === clientFilteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = clientFilteredMessages.map((m) => m.id);
      setSelectedIds(new Set(allIds));
    }
  };

  // Bulk action triggers - setup confirm configuration
  const triggerBulkAction = (actionType: 'trash' | 'archive' | 'read', ids: string[], senderNameContext?: string) => {
    if (!token || ids.length === 0) return;

    // Get list of subject summaries for confirmation dialog
    const targetMessagesList = clientFilteredMessages
      .filter((m) => ids.includes(m.id))
      .slice(0, 10)
      .map((m) => `"${m.subject}" da: ${m.fromName}`);

    if (clientFilteredMessages.filter((m) => ids.includes(m.id)).length > 10) {
      targetMessagesList.push(`... e altre ${ids.length - 10} email.`);
    }

    let title = '';
    let description = '';
    let isDestructive = true;
    let actionLabel = '';

    if (actionType === 'trash') {
      title = senderNameContext 
        ? `Spostare nel Cestino tutto da "${senderNameContext}"?`
        : `Spostare nel Cestino ${ids.length} email?`;
      description = 'Rimuoverai definitivamente queste email dalla Posta in Arrivo spostandole nel Cestino Gmail.';
      actionLabel = 'Sposta nel Cestino';
      isDestructive = true;
    } else if (actionType === 'archive') {
      title = senderNameContext
        ? `Archiviare tutte le email da "${senderNameContext}"?`
        : `Archiviare ${ids.length} email selezionate?`;
      description = 'Le email saranno conservate nel tuo account Gmail ma rimosse dall\'elenco Posta in Arrivo.';
      actionLabel = 'Archivia';
      isDestructive = false;
    } else {
      title = `Segnare come lette ${ids.length} email?`;
      description = 'Le email verranno rimosse dall\'elenco delle email non lette.';
      actionLabel = 'Segna come Letto';
      isDestructive = false;
    }

    setConfirmConfig({
      title,
      description,
      itemCount: ids.length,
      itemsList: targetMessagesList,
      actionType,
      targetIds: ids,
      isDestructive,
    });

    setConfirmOpen(true);
  };

  // Core modification routine
  const handleExecuteAction = async () => {
    if (!token) return;
    const { actionType, targetIds } = confirmConfig;
    
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let addLabels: string[] = [];
      let removeLabels: string[] = [];

      if (actionType === 'trash') {
        addLabels = ['TRASH'];
        removeLabels = ['INBOX'];
      } else if (actionType === 'archive') {
        removeLabels = ['INBOX'];
      } else if (actionType === 'read') {
        removeLabels = ['UNREAD'];
      }

      await batchModifyGmailMessages(token, targetIds, addLabels, removeLabels);

      // Instantly filter out or update modified items to avoid re-fetching lag
      if (actionType === 'trash' || actionType === 'archive') {
        setMessages((prev) => prev.filter((m) => !targetIds.includes(m.id)));
      } else if (actionType === 'read') {
        setMessages((prev) =>
          prev.map((m) => (targetIds.includes(m.id) ? { ...m, isUnread: false } : m))
        );
      }

      setSelectedIds(new Set());
      setSuccessMsg(`Operazione completata con successo per ${targetIds.length} email!`);

      // Dismiss success notification after 4s
      setTimeout(() => setSuccessMsg(null), 4000);

      // Refresh total counts from profile in background
      getGmailUserProfile(token).then(setProfile).catch(() => {});
    } catch (err: any) {
      console.error('Action execution failed:', err);
      setErrorMsg(`Errore nell'esecuzione dell'azione: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render Auth states
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 1.2 }}
            className="rounded-full p-2.5 text-blue-600 bg-blue-50/60 border border-blue-100"
          >
            <RefreshCw className="h-7 w-7" />
          </motion.div>
          <p className="text-xs font-semibold text-slate-500 font-sans">
            Inizializzazione sessione Gmail...
          </p>
        </div>
      </div>
    );
  }

  if (needsAuth || !user) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-50/40 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col items-center text-center"
        >
          {/* Logo Brand Icon */}
          <div className="h-14 w-14 bg-blue-600 text-white flex items-center justify-center rounded-xl shadow-sm shadow-blue-100 mb-6 font-bold text-2xl">
            P
          </div>

          <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase mb-2">
            PureMail Studio
          </span>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight mb-3">
            Pulisci la tua Gmail con stile
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-6 max-w-sm">
            Filtra ed elimina in blocco vecchie newsletter, email pesanti e messaggi non necessari in pochi secondi con il massimo della sicurezza.
          </p>

          <div className="relative w-full rounded-xl bg-slate-50 p-5 border border-slate-200/50 text-left space-y-3 mb-6">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-500" /> Come funziona:
            </h4>
            <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4 leading-relaxed font-semibold">
              <li>Visualizza un riepilogo grafico dello spazio occupato in Inbox</li>
              <li>Filtra iscrizioni e newsletter (contengono "unsubscribe")</li>
              <li>Sposta nel Cestino o archivia in blocco con estrema facilità</li>
              <li>I tuoi dati sono protetti in sicurezza tramite OAuth sicuro</li>
            </ul>
          </div>

          {/* Official Google Button Style */}
          <button
            onClick={handleLogin}
            className="gsi-material-button w-full sm:w-auto px-6 py-2.5 cursor-pointer shadow-xs border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper flex items-center gap-2.5">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-semibold">Accedi con Google</span>
            </div>
          </button>

          <p className="mt-6 text-[10px] text-slate-400">
            Effettuando l'accesso potrai accedere in sicurezza alle tue email, con autorizzazione revocabile in qualsiasi momento.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/20 flex flex-col lg:flex-row font-sans">
      {/* Sidebar navigation */}
      <aside className="lg:w-80 w-full shrink-0 bg-white border-b lg:border-r border-slate-200/80 p-6 lg:px-8 lg:py-8 flex flex-col justify-between lg:h-screen lg:sticky lg:top-0">
        <div className="space-y-8">
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              P
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
                PureMail
              </h1>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
                Cleaner per Gmail
              </span>
            </div>
          </div>

          {/* Quick presets list for sidebar */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 mb-2">Filtri Principali</p>
            {filterPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                  activeFilterId === preset.id && !isCustomQueryActive
                    ? 'bg-blue-50/70 text-blue-600 border-blue-100/50 font-bold'
                    : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/60'
                }`}
              >
                <preset.icon className={`h-4 w-4 ${activeFilterId === preset.id && !isCustomQueryActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="truncate">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User badge and storage in sidebar */}
        <div className="pt-6 border-t border-slate-100 mt-6 space-y-4">
          {/* Storage summary */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span>Analisi Lotto</span>
              <span>{maxResults} email</span>
            </div>
            <div className="h-1.5 bg-slate-200/60 rounded-full overflow-hidden mb-2">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(messages.length / maxResults) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
              {profile ? `${profile.messagesTotal} messaggi totali in Inbox` : 'Connesso ad account Gmail'}
            </p>
          </div>

          {/* Connected User Badge */}
          <div className="flex items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/50">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile Avatar"
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full ring-2 ring-slate-100 shrink-0"
                />
              ) : (
                <div className="h-8 w-8 bg-zinc-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-none mb-1">
                  {user.displayName || 'Utente Gmail'}
                </p>
                <p className="text-[9px] text-slate-400 font-mono truncate">
                  {profile?.emailAddress || user.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Esci dall'account"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top greeting banner inside main scroll view */}
        <header className="px-6 lg:px-10 pt-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1 font-mono">
              {isCustomQueryActive ? 'Query Custom Attiva' : `Filtro: ${filterPresets.find(p => p.id === activeFilterId)?.name}`}
            </span>
            <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight leading-none">
              Ciao, {user.displayName?.split(' ')[0] || 'Utente'}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md">
              Il tuo account è pronto. Facciamo un po' di spazio e pulizia nella tua posta elettronica.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => loadMessagesOfQuery(token!)}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Aggiornamento...' : 'Aggiorna Lotto'}</span>
            </button>
          </div>
        </header>

        {/* Main Content scrollable container padding */}
        <main className="px-6 lg:px-10 pb-10 flex-1 flex flex-col">
          {/* Alerts and notifications */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-100 flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <div className="flex-1">{errorMsg}</div>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 font-semibold cursor-pointer">
                  Nascondi
                </button>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-100 flex items-start gap-3"
              >
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="flex-1">{successMsg}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Inbox Statistics Widgets */}
          <StatsPanel
            stats={computedStats}
            onQuickFilter={handlePresetSelect}
            activeFilterId={isCustomQueryActive ? 'custom' : activeFilterId}
          />

          {/* Integrated parameter slider & search query block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Range limit parameter */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-semibold text-slate-500">Email da scaricare:</span>
                <span className="font-bold font-mono text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                  {maxResults}
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                step="10"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-1"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                <span>Scarica meno (Veloce)</span>
                <span>Max (250)</span>
              </div>
            </div>

            {/* Custom query string */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-center">
              <form onSubmit={handleCustomQuerySearch} className="flex gap-2 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="Ricerca Gmail personalizzata... (es. from:news@linkedin.com o category:promotions)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !customQuery.trim()}
                  className="bg-slate-900 border border-transparent text-white hover:bg-slate-800 font-semibold text-xs px-5 rounded-xl transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 shrink-0"
                >
                  Cerca
                </button>
              </form>
            </div>
          </div>

          {/* TAB NAVIGATION: List view vs Sender Breakdown */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-5 py-3 text-xs font-bold border-b-2 tracking-tight transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 Elenco Email ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab('senders')}
              className={`px-5 py-3 text-xs font-bold border-b-2 tracking-tight transition-all cursor-pointer ${
                activeTab === 'senders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📊 Mittenti più attivi
            </button>
          </div>

        {/* Loading Progress overlay inside main content */}
        {isLoading && loadingProgress && (
          <div className="mb-6 p-5 bg-white border border-slate-100 shadow-2xs rounded-2xl flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                Scaricamento dettagli email...
              </span>
              <span>
                {loadingProgress.loaded} di {loadingProgress.total} email
              </span>
            </div>
            {/* Progress Bar background */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="bg-blue-600 h-full rounded-full"
                animate={{ width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Carichiamo metadati per determinare con precisione la dimensione, mittente e dicitura d'iscrizione.
            </p>
          </div>
        )}

        {/* MAIN DISPLAY AREA */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'senders' ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <SenderAnalysis
                messages={messages}
                onAction={(actionType, ids, name) => triggerBulkAction(actionType, ids, name)}
              />
            </div>
          ) : (
            // List view
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col flex-1">
              {/* Toolbar & filtering actions panel */}
              {messages.length > 0 && (
                <div className="p-4 bg-slate-50/70 border-b border-slate-200/50 flex flex-col md:flex-row gap-3 md:items-center justify-between">
                  {/* Local Filtering query input */}
                  <div className="relative w-full md:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtra tra questi risultati..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Selected count action triggers */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 mr-2">
                      Selezionate: <strong className="font-bold text-slate-800 font-mono text-blue-600">{selectedIds.size}</strong>
                    </span>

                    <button
                      onClick={() => triggerBulkAction('archive', Array.from(selectedIds))}
                      disabled={selectedIds.size === 0 || isLoading}
                      className="px-3 py-2 border border-slate-200 cursor-pointer hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white shadow-3xs hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition-all"
                    >
                      <Archive className="h-4 w-4 text-slate-400" />
                      <span>Archivia in blocco</span>
                    </button>

                    <button
                      onClick={() => triggerBulkAction('trash', Array.from(selectedIds))}
                      disabled={selectedIds.size === 0 || isLoading}
                      className="px-3 py-2 border border-red-200 cursor-pointer hover:border-red-300 rounded-xl text-xs font-semibold text-red-600 bg-white hover:bg-red-50/50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                      <span>Elimina selezionate</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Emails List Block */}
              {clientFilteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center select-none flex-1">
                  <div className="h-12 w-12 bg-slate-50 border border-slate-100/80 text-slate-400 flex items-center justify-center rounded-xl mb-4">
                    <Inbox className="h-5 w-5 text-slate-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Cassetto vuoto</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    {isLoading
                      ? 'Analisi della posta in arrivo in corso...'
                      : 'Nessun messaggio trovato per questa categoria. Prova un altro filtro o un lotto più grande.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-150 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                        <th className="p-4 w-12 text-center">
                          <button
                            onClick={handleToggleSelectAll}
                            className="text-slate-400 hover:text-blue-600 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={
                                clientFilteredMessages.length > 0 &&
                                selectedIds.size === clientFilteredMessages.length
                              }
                              onChange={handleToggleSelectAll}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                          </button>
                        </th>
                        <th className="p-4 font-semibold min-w-[140px]">Mittente</th>
                        <th className="p-4 font-semibold">Oggetto & Anteprima</th>
                        <th className="p-4 font-semibold w-24 text-right">Dimensione</th>
                        <th className="p-4 font-semibold w-20 text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {clientFilteredMessages.map((msg) => {
                        const isSelected = selectedIds.has(msg.id);
                        
                        // Human readable size parsing
                        const displaySize =
                          msg.sizeEstimate > 1024 * 1024
                            ? `${(msg.sizeEstimate / (1024 * 1024)).toFixed(1)} MB`
                            : `${(msg.sizeEstimate / 1024).toFixed(0)} KB`;
 
                        // Compact date format
                        let humanDate = '';
                        try {
                          const dateObj = new Date(msg.date);
                          humanDate = dateObj.toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                          });
                        } catch (e) {
                          humanDate = msg.date;
                        }

                        return (
                          <tr
                            key={msg.id}
                            className={`group border-b border-dashed border-slate-100 last:border-0 hover:bg-slate-50/20 transition-colors ${
                              isSelected ? 'bg-blue-50/20' : ''
                            } ${msg.isUnread ? 'font-medium bg-slate-50/10' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="p-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectOne(msg.id)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                              />
                            </td>

                            {/* Contact From */}
                            <td className="p-4 min-w-[140px] max-w-[180px]">
                              <div className="flex flex-col truncate pr-2">
                                <span className={`text-slate-800 block truncate ${msg.isUnread ? 'font-bold text-slate-900' : ''}`}>
                                  {msg.fromName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                                  {msg.fromEmail}
                                </span>
                              </div>
                            </td>

                            {/* Subject Preview & Badges */}
                            <td className="p-4 min-w-[200px]">
                              <div className="flex flex-col gap-1 pr-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {msg.isUnread && (
                                    <span className="text-[9px] font-bold text-white bg-blue-600 rounded px-1.5 py-0.5 uppercase tracking-wider">
                                      Nuova
                                    </span>
                                  )}
                                  {msg.hasUnsubscribe && (
                                    <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-100/70 rounded px-1.5 py-0.5">
                                      Iscrizione
                                    </span>
                                  )}
                                  {msg.sizeEstimate > 5 * 1024 * 1024 && (
                                    <span className="text-[9px] font-semibold text-red-700 bg-red-50 border border-red-100/70 rounded px-1.5 py-0.5">
                                      Ingombrante
                                    </span>
                                  )}
                                  <span className="text-slate-900 leading-tight">
                                    {msg.subject || '(Senza oggetto)'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-normal line-clamp-1 max-w-2xl leading-relaxed">
                                  {msg.snippet}
                                </span>
                              </div>
                            </td>

                            {/* Size & Date indicator */}
                            <td className="p-4 text-right align-middle shrink-0 font-medium">
                              <span className="text-slate-705 block text-[11px]">
                                {displaySize}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-normal">
                                {humanDate}
                              </span>
                            </td>

                            {/* Discrete hover action buttons */}
                            <td className="p-4 text-center align-middle">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => triggerBulkAction('archive', [msg.id])}
                                  title="Archivia questa email"
                                  className="p-1.5 text-slate-400 cursor-pointer hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-250 shadow-2xs opacity-80 group-hover:opacity-100"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => triggerBulkAction('trash', [msg.id])}
                                  title="Sposta nel Cestino"
                                  className="p-1.5 text-slate-400 cursor-pointer hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shadow-2xs opacity-80 group-hover:opacity-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Window Safe Modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecuteAction}
        title={confirmConfig.title}
        description={confirmConfig.description}
        itemCount={confirmConfig.itemCount}
        itemsList={confirmConfig.itemsList}
        actionLabel={confirmConfig.actionType === 'trash' ? 'Sposta nel Cestino' : confirmConfig.actionType === 'archive' ? 'Archivia' : 'Segna come Letto'}
        isDestructive={confirmConfig.isDestructive}
      />

      {/* Bottom Footer block */}
      <footer className="w-full border-t border-slate-200/50 py-6 mt-12 bg-white flex items-center justify-center text-xs text-slate-400 shrink-0">
        <div className="flex flex-col gap-2 items-center text-center px-4">
          <div className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-blue-500" />
            <span>PureMail Studio Security Link</span>
          </div>
          <p className="font-sans leading-relaxed text-[10px] max-w-md text-slate-400">
            Tutti i dati e i messaggi dell'account Workspace vengono trasmessi direttamente sui server protetti Google. Offerto con autenticazione sicura.
          </p>
        </div>
      </footer>
    </div>
  </div>
  );
}
