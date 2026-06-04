import { useMemo, useState } from 'react';
import { GmailMessage, SenderGroup } from '../types';
import { Mail, Trash2, Archive, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';

interface SenderAnalysisProps {
  messages: GmailMessage[];
  onAction: (actionType: 'trash' | 'archive', messageIds: string[], senderName: string) => void;
}

export default function SenderAnalysis({ messages, onAction }: SenderAnalysisProps) {
  const [expandedSender, setExpandedSender] = useState<string | null>(null);

  // Group messages by sender email
  const senderGroups = useMemo(() => {
    const groups: { [email: string]: SenderGroup } = {};

    for (const msg of messages) {
      if (!groups[msg.fromEmail]) {
        groups[msg.fromEmail] = {
          senderEmail: msg.fromEmail,
          senderName: msg.fromName || msg.fromEmail,
          count: 0,
          totalSize: 0,
          messages: [],
        };
      }
      const g = groups[msg.fromEmail];
      g.count += 1;
      g.totalSize += msg.sizeEstimate;
      g.messages.push(msg);
    }

    // Convert to array and sort by count descending
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [messages]);

  // Format size helper
  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const toggleExpand = (email: string) => {
    setExpandedSender(expandedSender === email ? null : email);
  };

  if (senderGroups.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl">
        <p className="text-sm text-slate-500">Nessun mittente da analizzare. Carica prima le email.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-slate-900 font-sans tracking-tight">Analisi Frequenza Mittenti</h4>
          <p className="text-xs text-slate-500">Mittenti ordinati per volume di email nel lotto corrente</p>
        </div>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100/80 border border-slate-200/50 px-3 py-1 rounded-full">
          {senderGroups.length} Mittenti differenti
        </span>
      </div>

      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm divide-y divide-slate-100">
        {senderGroups.slice(0, 15).map((group) => {
          const isExpanded = expandedSender === group.senderEmail;
          const ids = group.messages.map((m) => m.id);

          return (
            <div key={group.senderEmail} className="group transition-colors duration-150">
              {/* Row Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 bg-white hover:bg-slate-50/40">
                <div 
                  onClick={() => toggleExpand(group.senderEmail)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                >
                  <div className="flex items-center justify-center p-2.5 bg-slate-50 text-slate-500 rounded-xl group-hover:bg-slate-100 group-hover:text-blue-600 transition-colors border border-slate-200/40">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-slate-900 block truncate leading-tight">
                      {group.senderName}
                    </span>
                    <span className="text-xs text-slate-400 block truncate mt-1">
                      {group.senderEmail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0">
                  {/* Stats info */}
                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-800 block">
                      {group.count} {group.count === 1 ? 'email' : 'email'}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px] block mt-1">
                      {formatSize(group.totalSize)}
                    </span>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAction('archive', ids, group.senderName)}
                      title={`Archivia tutto da ${group.senderName}`}
                      className="p-2 cursor-pointer text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold px-3"
                    >
                      <Archive className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" />
                      <span className="hidden leading-none sm:inline">Archivia</span>
                    </button>
                    <button
                      onClick={() => onAction('trash', ids, group.senderName)}
                      title={`Sposta nel Cestino tutto da ${group.senderName}`}
                      className="p-2 cursor-pointer text-red-600 hover:bg-red-50 rounded-lg border border-red-100 hover:border-red-200 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold px-3"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden leading-none sm:inline">Elimina</span>
                    </button>
                    <button
                      onClick={() => toggleExpand(group.senderEmail)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub list details */}
              {isExpanded && (
                <div className="bg-slate-50/40 p-5 border-t border-slate-100 max-h-60 overflow-y-auto space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Elenco email ricevute da questo mittente:
                  </div>
                  {group.messages.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-800 truncate block">
                          {m.subject}
                        </span>
                        <p className="text-slate-500 text-[11px] truncate mt-0.5">
                          {m.snippet}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-[10px] text-slate-400 font-mono">
                        {formatSize(m.sizeEstimate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {senderGroups.length > 15 && (
        <p className="text-center text-xs text-slate-400">
          Mostrati i primi 15 mittenti più frequenti di questo blocco.
        </p>
      )}
    </div>
  );
}
