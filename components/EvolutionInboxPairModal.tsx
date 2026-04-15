"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Wifi, WifiOff, CheckCircle2 } from "lucide-react";

export type PairInboxInfo = {
  id: string;
  name: string;
  evolutionInstanceName: string | null;
  /** Se true, abre o modal e já sincroniza webhook + pede QR (fluxo “Adicionar número”). */
  autoStartSyncWebhook?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  inbox: PairInboxInfo | null;
};

function digitsForEvolution(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) d = `55${d}`;
  return d;
}

const EVOLUTION_PAIR_FRIENDLY_ERROR =
  "Erro de conexão: O servidor da Evolution demorou a responder. Verifique se a URL e a porta estão corretas.";

function isFetchOrTimeoutMessage(msg: string): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("aborted") ||
    m.includes("connect timeout")
  );
}

export const EvolutionInboxPairModal: React.FC<Props> = ({ open, onClose, inbox }) => {
  const [phone, setPhone] = useState("");
  const [deviceOs, setDeviceOs] = useState<"any" | "android" | "ios">("any");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [evolution, setEvolution] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [conn, setConn] = useState<{ state: string | null } | null>(null);
  const [waitingQr, setWaitingQr] = useState(false);
  const [webhookQr, setWebhookQr] = useState<string | null>(null);
  const autoPairLaunchedRef = useRef(false);
  /** Sessão conectada: mensagem de sucesso e fechamento automático. */
  const [pairSuccess, setPairSuccess] = useState(false);
  const closeSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeScheduledRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setPhone("");
      setDeviceOs("any");
      setErr(null);
      setEvolution(null);
      setSyncResult(null);
      setConn(null);
      setWaitingQr(false);
      setWebhookQr(null);
      autoPairLaunchedRef.current = false;
      setPairSuccess(false);
      closeScheduledRef.current = false;
      if (closeSuccessTimerRef.current) {
        clearTimeout(closeSuccessTimerRef.current);
        closeSuccessTimerRef.current = null;
      }
    }
  }, [open, inbox?.id]);

  const runConnect = useCallback(
    async (syncWebhook: boolean) => {
      if (!inbox?.id) return;
      setLoading(true);
      setErr(null);
      setEvolution(null);
      setSyncResult(null);
      setWebhookQr(null);
      try {
        const r = await fetch("/api/crm/evolution-pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboxId: inbox.id,
            phoneDigits: digitsForEvolution(phone),
            syncWebhook,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (j?.userMessage) {
            setErr(String(j.userMessage));
            return;
          }
          const raw = String(j?.error || "Falha ao conectar");
          setErr(
            isFetchOrTimeoutMessage(raw) || raw === "EVOLUTION_CONNECTION_FAILED"
              ? EVOLUTION_PAIR_FRIENDLY_ERROR
              : raw
          );
          return;
        }
        setEvolution(j.evolution);
        setSyncResult(j.syncWebhook);
        if (j.connectionHint?.state) {
          setConn({ state: j.connectionHint.state });
        }
        const ev = j.evolution;
        const inline =
          ev?.base64 ||
          ev?.qrcode?.base64 ||
          (typeof ev?.code === "string" && ev.code.startsWith("data:image") ? ev.code : null);
        if (!inline) {
          setWaitingQr(true);
        } else {
          setWaitingQr(false);
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        setErr(isFetchOrTimeoutMessage(msg) ? EVOLUTION_PAIR_FRIENDLY_ERROR : msg);
      } finally {
        setLoading(false);
      }
    },
    [inbox?.id, phone]
  );

  useEffect(() => {
    if (!open || !inbox?.autoStartSyncWebhook || autoPairLaunchedRef.current) return;
    autoPairLaunchedRef.current = true;
    const t = setTimeout(() => void runConnect(true), 500);
    return () => clearTimeout(t);
  }, [open, inbox?.id, inbox?.autoStartSyncWebhook, runConnect]);

  useEffect(() => {
    if (!open || !inbox?.id) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(
          `/api/crm/evolution-pair?inboxId=${encodeURIComponent(inbox.id)}&mode=status`,
          { cache: "no-store" }
        );
        const j = await r.json();
        if (!cancelled && j?.connection) {
          setConn({ state: j.connection.state });
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, inbox?.id]);

  useEffect(() => {
    if (!waitingQr || !inbox?.id) return;
    let cancelled = false;
    const t0 = Date.now();
    const maxMs = 120_000;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - t0 > maxMs) {
        setWaitingQr(false);
        return;
      }
      try {
        const r = await fetch(
          `/api/crm/evolution-pair?inboxId=${encodeURIComponent(inbox.id)}&mode=qr`,
          { cache: "no-store" }
        );
        const j = await r.json();
        if (j?.hasQr && j?.base64) {
          setWebhookQr(j.base64);
          setWaitingQr(false);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waitingQr, inbox?.id]);

  const stateLower = (conn?.state || "").toLowerCase();
  const looksConnected =
    stateLower.includes("open") ||
    stateLower === "connected" ||
    stateLower.includes("success");

  useEffect(() => {
    if (!open) {
      closeScheduledRef.current = false;
      setPairSuccess(false);
      if (closeSuccessTimerRef.current) {
        clearTimeout(closeSuccessTimerRef.current);
        closeSuccessTimerRef.current = null;
      }
      return;
    }
    if (!looksConnected) {
      closeScheduledRef.current = false;
      setPairSuccess(false);
      if (closeSuccessTimerRef.current) {
        clearTimeout(closeSuccessTimerRef.current);
        closeSuccessTimerRef.current = null;
      }
      return;
    }
    if (closeScheduledRef.current) return;
    closeScheduledRef.current = true;
    setPairSuccess(true);
    if (closeSuccessTimerRef.current) clearTimeout(closeSuccessTimerRef.current);
    closeSuccessTimerRef.current = setTimeout(() => {
      closeSuccessTimerRef.current = null;
      onCloseRef.current();
    }, 2800);
    return () => {
      if (closeSuccessTimerRef.current) {
        clearTimeout(closeSuccessTimerRef.current);
        closeSuccessTimerRef.current = null;
      }
    };
  }, [open, looksConnected]);

  if (!open || !inbox) return null;

  const ev = evolution;
  const base64 =
    webhookQr ||
    ev?.base64 ||
    ev?.qrcode?.base64 ||
    (typeof ev?.code === "string" && ev.code.startsWith("data:image") ? ev.code : null);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evo-pair-title"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="evo-pair-title" className="text-sm font-black text-sl-navy">
              Conectar WhatsApp Web
            </h2>
            <p className="mt-1 text-[11px] text-slate-600">
              Caixa <span className="font-semibold">{inbox.name}</span> · instância{" "}
              <code className="text-[10px] bg-slate-100 px-1 rounded">{inbox.evolutionInstanceName || "—"}</code>
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
          {looksConnected ? (
            <Wifi size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <WifiOff size={16} className="text-amber-600 shrink-0" />
          )}
          <span>
            Status Evolution:{" "}
            <strong>{conn?.state || "—"}</strong>
            {looksConnected && " · sessão ativa"}
          </span>
        </div>

        {pairSuccess && (
          <div className="mt-3 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/95 px-3 py-3 text-[11px] text-emerald-900">
            <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0">
              <p className="font-bold text-emerald-950">WhatsApp conectado com sucesso</p>
              <p className="mt-1 text-emerald-900/90 leading-relaxed">
                A sessão Web desta caixa está ativa. Esta janela fechará em instantes. Você pode fechar agora se
                preferir.
              </p>
              <button
                type="button"
                className="mt-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[10px] font-bold text-emerald-900 hover:bg-emerald-50"
                onClick={() => onClose()}
              >
                Fechar agora
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="text-[10px] font-semibold text-slate-700">Onde você vai escanear o QR?</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(
              [
                { id: "any" as const, label: "Tanto faz" },
                { id: "android" as const, label: "Android" },
                { id: "ios" as const, label: "iPhone" },
              ]
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setDeviceOs(b.id)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                  deviceOs === b.id
                    ? "border-sl-navy bg-sl-navy/10 text-sl-navy"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
            O QR é o mesmo; só mudam os passos no celular.{" "}
            {deviceOs === "ios" && (
              <>
                No iPhone: <strong>Configurações</strong> do WhatsApp → <strong>Aparelhos conectados</strong> →{" "}
                <strong>Conectar um aparelho</strong>.
              </>
            )}
            {deviceOs === "android" && (
              <>
                No Android: toque nos <strong>três pontos</strong> → <strong>Aparelhos conectados</strong> →{" "}
                <strong>Conectar um aparelho</strong>.
              </>
            )}
            {deviceOs === "any" && <>Use <strong>Aparelhos conectados</strong> no menu do WhatsApp e escaneie abaixo.</>}
          </p>
        </div>

        <label className="mt-4 block text-[11px] font-medium text-slate-700">
          Número do WhatsApp (com DDI 55 — recomendado)
        </label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 disabled:opacity-60"
          placeholder="5562991234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={pairSuccess}
        />

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
            {err}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || pairSuccess}
            onClick={() => runConnect(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-sl-navy to-sl-navy-light px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Gerar QR
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Ao gerar o QR, o CRM já configura a URL do webhook e os eventos na instância da Evolution automaticamente.
        </p>

        {syncResult && !syncResult.ok && syncResult.error && (
          <p className="mt-2 text-[10px] text-amber-800">Webhook: {syncResult.error}</p>
        )}

        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 min-h-[200px]">
          {pairSuccess ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-[11px] text-emerald-800">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden />
              <p className="font-semibold">Conexão estabelecida</p>
              <p className="max-w-xs text-emerald-800/85">Não é necessário escanear o QR enquanto a sessão estiver aberta.</p>
            </div>
          ) : base64 ? (
            <img src={base64} alt="QR Code WhatsApp" className="max-w-[240px] rounded-lg border border-white shadow" />
          ) : waitingQr ? (
            <div className="text-center text-[11px] text-slate-600">
              <Loader2 className="mx-auto mb-2 animate-spin text-sl-navy" size={28} />
              Aguardando QR (webhook <code className="text-[10px]">QRCODE_UPDATED</code>)…
            </div>
          ) : (
            <p className="text-center text-[11px] text-slate-500">
              Clique em &quot;Gerar QR&quot; para exibir o código aqui.
            </p>
          )}
        </div>

        <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
          Escaneie com o WhatsApp no celular (Aparelhos conectados). O status acima atualiza a cada poucos segundos.
          Se o QR não aparecer, confira se o servidor Evolution está acessível a partir da Vercel e se o{" "}
          <code className="bg-slate-100 px-0.5 rounded">QRCODE_UPDATED</code> está ligado no webhook.
        </p>
      </div>
    </div>
  );
};
