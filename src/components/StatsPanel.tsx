import { InboxStats } from '../types';
import { Mail, ShieldCheck, Database, Calendar } from 'lucide-react';

interface StatsPanelProps {
  stats: InboxStats;
  onQuickFilter: (filterId: string) => void;
  activeFilterId: string;
}

export default function StatsPanel({ stats, onQuickFilter, activeFilterId }: StatsPanelProps) {
  // Format size in MB or KB
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const widgets = [
    {
      id: 'newsletters',
      label: 'Newsletters',
      value: stats.totalNewsletters,
      icon: Mail,
      desc: 'Email di iscrizioni e promozioni',
      textColor: 'text-red-500',
      bgColor: 'bg-red-50/60 border-red-100/70 hover:bg-red-50/90',
      iconBg: 'bg-red-50 text-red-500',
      filterId: 'newsletter',
    },
    {
      id: 'large',
      label: 'File Voluminosi',
      value: stats.totalLarge,
      icon: Database,
      desc: 'Allegati pesanti > 5MB',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50/60 border-amber-100/70 hover:bg-amber-50/90',
      iconBg: 'bg-amber-100/60 text-amber-700',
      filterId: 'large',
    },
    {
      id: 'old',
      label: 'Email Vecchie',
      value: stats.totalOld,
      icon: Calendar,
      desc: 'Ricevute più di un anno fa',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50/60 border-green-100/70 hover:bg-green-50/90',
      iconBg: 'bg-green-100/60 text-green-700',
      filterId: 'old',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {/* Total Mail Space Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500">Dimensione Lotto</span>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-bold font-sans text-slate-900 tracking-tight">
            {formatSize(stats.totalSize)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Spazio occupato dalle {stats.totalAnalyzed} email
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Non lette nel lotto:</span>
          <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {stats.totalUnread}
          </span>
        </div>
      </div>

      {/* Dynamic Quick filters metrics */}
      {widgets.map((w) => {
        const Icon = w.icon;
        const isActive = activeFilterId === w.filterId;
        return (
          <button
            key={w.id}
            onClick={() => onQuickFilter(w.filterId)}
            className={`group text-left rounded-xl border p-6 shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between outline-hidden ${
              isActive
                ? `ring-2 ring-blue-500 bg-white border-transparent`
                : `${w.bgColor}`
            }`}
          >
            <div className="flex items-center justify-between w-full mb-4">
              <span className="text-sm font-semibold text-slate-800">{w.label}</span>
              <div className={`p-2 rounded-xl transition-colors ${w.iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-950 tracking-tight">{w.value}</h3>
              <p className="text-xs text-slate-500 mt-1">{w.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100/60 flex items-center justify-between text-xs text-slate-500 w-full font-semibold">
              <span className="group-hover:text-blue-600 transition-colors">Vedi filtri →</span>
              {isActive && (
                <span className="font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                  Attivo
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
