import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemCount: number;
  itemsList?: string[];
  actionLabel?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemCount,
  itemsList = [],
  actionLabel = 'Conferma',
  isDestructive = true,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-xl border border-slate-100"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  isDestructive
                    ? 'bg-red-50 text-red-600 border border-red-100'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900 leading-tight">
                  {title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            {/* Middle Section with Item count/list */}
            <div className="mt-5 rounded-xl bg-slate-50 p-4 border border-slate-100/80">
              <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                <span>Elementi interessati:</span>
                <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {itemCount} {itemCount === 1 ? 'email' : 'email'}
                </span>
              </div>

              {itemsList.length > 0 && (
                <div className="mt-3 max-h-36 overflow-y-auto space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                  {itemsList.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-600 truncate border-b border-dashed border-slate-100 pb-1.5 last:border-0 last:pb-0"
                    >
                      <span className="font-medium text-slate-800 block truncate">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {isDestructive
                ? 'Nota: Le email rimosse verranno spostate nel Cestino di Gmail e rimosse dalla tua Posta in arrivo. Potrai comunque recuperarle dal Cestino entro 30 giorni.'
                : 'Nota: Le email verranno rimosse solo dalla Posta in Arrivo mantenendole negli archivi.'}
            </p>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {actionLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
