"use client";

import React from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type AppMessageVariant = "success" | "error" | "warning" | "info";

type MessageModalProps = {
  open: boolean;
  title: string;
  message: string;
  variant?: AppMessageVariant;
  actionLabel?: string;
  onClose: () => void;
};

const variantStyles: Record<
  AppMessageVariant,
  { border: string; bg: string; icon: React.ReactNode; title: string }
> = {
  success: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/90",
    icon: <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" aria-hidden />,
    title: "text-emerald-900",
  },
  error: {
    border: "border-red-200",
    bg: "bg-red-50/90",
    icon: <AlertCircle className="h-8 w-8 text-red-600 shrink-0" aria-hidden />,
    title: "text-red-900",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50/90",
    icon: <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" aria-hidden />,
    title: "text-amber-900",
  },
  info: {
    border: "border-sky-200",
    bg: "bg-sky-50/90",
    icon: <Info className="h-8 w-8 text-sky-600 shrink-0" aria-hidden />,
    title: "text-sky-900",
  },
};

/** Substitui `alert()` com visual alinhado ao CRM (São Luiz Express). */
export function AppMessageModal({
  open,
  title,
  message,
  variant = "info",
  actionLabel = "Entendi",
  onClose,
}: MessageModalProps) {
  if (!open) return null;
  const s = variantStyles[variant];
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-msg-title"
      aria-describedby="app-msg-desc"
      onClick={onClose}
    >
      <div
        className={`max-w-md w-full rounded-2xl border ${s.border} ${s.bg} shadow-2xl p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {s.icon}
          <div className="min-w-0 flex-1">
            <h2 id="app-msg-title" className={`text-sm font-black ${s.title}`}>
              {title}
            </h2>
            <p id="app-msg-desc" className="mt-2 text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#2c348c] to-[#1f2f86] px-4 py-2.5 text-xs font-bold text-white hover:opacity-95"
              onClick={onClose}
            >
              {actionLabel}
            </button>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-500 hover:bg-white/60 shrink-0"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

/** Substitui `confirm()` com modal acessível e consistente. */
export function AppConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;
  const confirmClass = danger
    ? "bg-red-600 hover:bg-red-700 text-white border border-red-700"
    : "bg-gradient-to-r from-[#2c348c] to-[#1f2f86] text-white border border-slate-300/20";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-confirm-title"
      aria-describedby="app-confirm-desc"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="app-confirm-title" className="text-sm font-black text-[#06183e] pr-6">
            {title}
          </h2>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 shrink-0 disabled:opacity-50"
            aria-label="Fechar"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>
        <p id="app-confirm-desc" className="mt-3 text-[12px] text-slate-600 leading-relaxed">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 ${confirmClass}`}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
