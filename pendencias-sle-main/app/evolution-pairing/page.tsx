"use client";

import React, { useEffect, useState } from "react";
import { getSitePublicBaseUrl } from "../../lib/sitePublicUrl";

/**
 * Fallback local: pareamento Evolution sem depender do WebSocket do Manager (Edge).
 * Local: /evolution-pairing — em produção use a mesma rota no domínio Vercel.
 */
export default function EvolutionPairingPage() {
  const [instance, setInstance] = useState("Maria");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [webhookQr, setWebhookQr] = useState<string | null>(null);
  const [waitingQr, setWaitingQr] = useState(false);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  /** Só preenchido no cliente (após mount) — evita mismatch de hidratação com window.location.origin. */
  const [webhookOrigin, setWebhookOrigin] = useState(() => getSitePublicBaseUrl());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    if (!getSitePublicBaseUrl() && typeof window !== "undefined") {
      setWebhookOrigin(window.location.origin);
    }
  }, []);

  /** Brasil: 10–11 dígitos sem DDI → prefixa 55 (ex.: 6299… → 556299…). */
  function digitsForEvolution(raw: string): string {
    let d = raw.replace(/\D/g, "");
    if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) {
      d = `55${d}`;
    }
    return d;
  }

  const syncWebhookViaApi = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    setErr(null);
    try {
      // Produção: NEXT_PUBLIC_APP_URL (Vercel). Dev Docker: host.docker.internal.
      const base =
        getSitePublicBaseUrl() ||
        (webhookOrigin &&
        !webhookOrigin.includes("localhost") &&
        !webhookOrigin.includes("127.0.0.1")
          ? webhookOrigin
          : "http://host.docker.internal:3000");
      const r = await fetch(
        `/api/evolution/sync-webhook?instance=${encodeURIComponent(instance.trim())}&publicBase=${encodeURIComponent(base)}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      setSyncResult(j);
      if (!r.ok && j?.error) setErr(String(j.error));
    } catch (e: any) {
      setSyncResult({ error: e?.message || String(e) });
    } finally {
      setSyncLoading(false);
    }
  };

  const callProxy = async (opts?: { pollAfter?: boolean }) => {
    const pollAfter = opts?.pollAfter !== false;
    setLoading(true);
    setErr(null);
    setResult(null);
    setWebhookQr(null);
    setPollStatus(null);
    try {
      const usp = new URLSearchParams({ instance: instance.trim() });
      const digits = digitsForEvolution(number);
      if (digits.length >= 12) usp.set("number", digits);
      const r = await fetch(`/api/evolution/connect-proxy?${usp}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error || JSON.stringify(j));
        return;
      }
      setResult(j);
      const ev0 = j?.evolution;
      const inline =
        ev0?.base64 ||
        ev0?.qrcode?.base64 ||
        (typeof ev0?.code === "string" && ev0.code.startsWith("data:image") ? ev0.code : null);
      if (pollAfter && !inline) {
        setWaitingQr(true);
        setPollStatus(
          "Resposta da API veio sem QR (comum na v2.2.x). Aguardando evento QRCODE_UPDATED no webhook…"
        );
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!waitingQr || !instance.trim()) return;
    let cancelled = false;
    const inst = instance.trim();
    const t0 = Date.now();
    const maxMs = 120_000;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - t0 > maxMs) {
        setWaitingQr(false);
        setPollStatus((s) => `${s || ""} Tempo esgotado — confira o webhook e tente de novo.`);
        return;
      }
      try {
        const r = await fetch(`/api/evolution/qr-last?instance=${encodeURIComponent(inst)}`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (j?.hasQr && j?.base64) {
          setWebhookQr(j.base64);
          setWaitingQr(false);
          setPollStatus("QR recebido via webhook.");
          return;
        }
      } catch {
        /* ignorar um tick */
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waitingQr, instance]);

  const ev = result?.evolution;
  const pairing = ev?.pairingCode || ev?.pairingcode;
  const code = ev?.code;
  const base64 =
    webhookQr ||
    ev?.base64 ||
    ev?.qrcode?.base64 ||
    (typeof code === "string" && code.startsWith("data:image") ? code : null);

  const webhookExamplePath = "/api/whatsapp/evolution/webhook";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-2">Evolution — pareamento (fallback)</h1>
      <p className="text-sm text-slate-400 mb-4">
        Use quando o Manager em <code className="text-emerald-300">localhost:8080</code> não mostrar o QR (ex.: Edge
        sem WebSocket). O Next chama a Evolution no servidor — mas a API muitas vezes responde só{" "}
        <code className="text-slate-300">{"{ count: 0 }"}</code>; o QR costuma chegar pelo webhook{" "}
        <code className="text-slate-300">QRCODE_UPDATED</code>.
      </p>
      <div className="mb-4 rounded-lg border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-100/95">
        <strong className="text-rose-200">Só aparece connection.update no terminal?</strong> Com{" "}
        <code className="text-rose-300">QRCODE_UPDATED</code> já ligado no Manager, o problema costuma ser a instância
        <strong> presa em connecting</strong> (Baileys não gera QR). Use o número <strong>com DDI 55</strong> no campo
        abaixo (ex.: <code className="text-rose-300">5562992954883</code> — sem isso a Evolution pode chamar{" "}
        <code className="text-rose-300">/connect</code> errado). Abra o Manager em{" "}
        <code className="text-rose-300">http://localhost:8080/manager</code> (não 127.0.0.1). Se continuar, apague a
        instância, limpe o volume Docker da Evolution e crie de novo.
      </div>
      <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-1">Webhook na instância (Evolution Manager)</p>
        <p>
          URL (POST é o que importa; abrir no navegador só confere se o Next responde):{" "}
          <code className="text-emerald-300 break-all">
            {webhookOrigin}
            {webhookExamplePath}?token=VALOR_DO_ENV
          </code>
          Troque <code className="text-slate-400">VALOR_DO_ENV</code> pelo mesmo valor de{" "}
          <code className="text-slate-400">EVOLUTION_WEBHOOK_TOKEN</code>, ou apague{" "}
          <code className="text-slate-400">?token=...</code> e deixe essa variável vazia/ausente no <code className="text-slate-400">.env</code>.
          Com secret no .env e URL sem o token certo, o POST do Evolution recebe 401.
        </p>
        <p className="mt-1">
          Marque o evento <code className="text-slate-300">QRCODE_UPDATED</code> (ou equivalente). Sem isso, o aguardar QR abaixo não recebe nada.
        </p>
        <p className="mt-2 rounded border border-amber-900/60 bg-amber-950/30 px-2 py-1.5 text-amber-100/90">
          <strong className="text-amber-200">Evolution no Docker?</strong> Dentro do container,{" "}
          <code className="text-amber-300">localhost:3000</code> não é o Next no seu PC. Use algo como{" "}
          <code className="break-all text-amber-300">
            http://host.docker.internal:3000{webhookExamplePath}?token=…
          </code>{" "}
          (Docker Desktop Windows/Mac) ou o IP da máquina na LAN.
        </p>
        <p className="mt-2 text-slate-500">
          Se o Manager tiver <strong className="text-slate-400">URL base</strong> + campo de webhook, não repita o caminho: base{" "}
          <code className="text-slate-400">http://host.docker.internal:3000</code> e path só{" "}
          <code className="text-slate-400">/api/whatsapp/evolution/webhook</code> — ou use uma única URL completa no campo de webhook.
        </p>
        <p className="mt-2 text-slate-500">
          No webhook da instância, ligue <strong className="text-slate-400">Webhook Base64</strong> se existir — sem isso o QR pode não vir no POST.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <label className="block text-xs text-slate-400">Nome da instância (igual ao Manager)</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          value={instance}
          onChange={(e) => setInstance(e.target.value)}
        />
        <label className="block text-xs text-slate-400">Número do WhatsApp (só dígitos, com 55 — opcional mas recomendado)</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          placeholder="5562912345678"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => callProxy()}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Consultando…" : "Buscar código / dados de conexão"}
        </button>
        <button
          type="button"
          disabled={loading || !instance.trim()}
          onClick={() => {
            setWebhookQr(null);
            setResult(null);
            setErr(null);
            setPollStatus("Aguardando QRCODE_UPDATED (dispare connect no Manager ou use o botão acima).");
            setWaitingQr(true);
          }}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          Só aguardar QR (webhook já configurado)
        </button>
        <button
          type="button"
          disabled={syncLoading || !instance.trim()}
          onClick={() => syncWebhookViaApi()}
          className="w-full rounded-lg border border-cyan-800 bg-cyan-950/50 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900/40 disabled:opacity-50"
        >
          {syncLoading ? "Sincronizando…" : "Forçar webhook na Evolution (API — QRCODE_UPDATED + Base64)"}
        </button>
        <p className="text-[11px] text-slate-500">
          Se o Manager não gravar os eventos, este botão chama <code className="text-slate-400">POST /webhook/set/…</code> na
          Evolution. Depois clique <strong>Conectar</strong> de novo no Manager.
        </p>
      </div>

      {syncResult && (
        <details className="mt-4 text-xs" open>
          <summary className="cursor-pointer text-cyan-600/90">Resultado sincronizar webhook</summary>
          <pre className="mt-2 overflow-auto rounded bg-slate-900 p-3 text-slate-300">{JSON.stringify(syncResult, null, 2)}</pre>
        </details>
      )}

      {pollStatus && <p className="mt-3 text-xs text-slate-500">{pollStatus}</p>}

      {err && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{err}</div>
      )}

      {pairing && (
        <div className="mt-6 rounded-xl border border-amber-700 bg-amber-950/40 p-4">
          <p className="text-sm text-amber-100/90 mb-2">
            No celular: <strong>Aparelhos conectados → Conectar aparelho → Vincular com número de telefone</strong> e informe:
          </p>
          <p className="text-3xl font-mono font-black tracking-widest text-white text-center py-4">{pairing}</p>
        </div>
      )}

      {base64 && (
        <div className="mt-6 rounded-xl border border-slate-600 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={base64} alt="QR WhatsApp" className="mx-auto max-w-[280px]" />
        </div>
      )}

      {result && (
        <details className="mt-6 text-xs">
          <summary className="cursor-pointer text-slate-500">Resposta bruta (debug)</summary>
          <pre className="mt-2 overflow-auto rounded bg-slate-900 p-3 text-slate-300">{JSON.stringify(result, null, 2)}</pre>
        </details>
      )}

      <p className="mt-8 text-[11px] text-slate-600">
        Requer <code className="text-slate-400">EVOLUTION_API_KEY</code> e opcionalmente{" "}
        <code className="text-slate-400">EVOLUTION_API_URL</code> no <code className="text-slate-400">.env</code> do Next.
      </p>
    </div>
  );
}
