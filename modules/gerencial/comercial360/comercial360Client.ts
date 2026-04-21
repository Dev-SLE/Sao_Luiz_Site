import { BI_COMERCIAL_360_CONFIG } from "@/modules/bi/comercial360/config";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function defaultComercial360Period(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    to: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

export type Comercial360FacetOptions = {
  mensalistas: string[];
  temContrato: string[];
  cidades: string[];
  statusAtividades: string[];
  categorias: string[];
  tiposDocumento: string[];
  tomadores: string[];
  remetentes: string[];
  destinatarios: string[];
};

export type Comercial360FilterState = {
  from: string;
  to: string;
  mensalista: string[];
  temContrato: string[];
  cidade: string[];
  statusAtividade: string[];
  categoria: string[];
  tipoDocumento: string[];
  atuouTomador: string[];
  atuouRemetente: string[];
  atuouDestinatario: string[];
};

const F = BI_COMERCIAL_360_CONFIG.filters;

export function emptyComercial360Filters(): Comercial360FilterState {
  return {
    from: "",
    to: "",
    mensalista: [],
    temContrato: [],
    cidade: [],
    statusAtividade: [],
    categoria: [],
    tipoDocumento: [],
    atuouTomador: [],
    atuouRemetente: [],
    atuouDestinatario: [],
  };
}

export function buildComercial360QueryString(s: Comercial360FilterState): string {
  const u = new URLSearchParams();
  const from = s.from || defaultComercial360Period().from;
  const to = s.to || defaultComercial360Period().to;
  u.set("from", from);
  u.set("to", to);
  s.mensalista.forEach((v) => u.append(F.mensalista, v));
  s.temContrato.forEach((v) => u.append(F.temContrato, v));
  s.cidade.forEach((v) => u.append(F.cidadeUf, v));
  s.statusAtividade.forEach((v) => u.append(F.statusAtividade, v));
  s.categoria.forEach((v) => u.append(F.categoria, v));
  s.tipoDocumento.forEach((v) => u.append(F.tipoDocumento, v));
  s.atuouTomador.forEach((v) => u.append(F.atuouTomador, v));
  s.atuouRemetente.forEach((v) => u.append(F.atuouRemetente, v));
  s.atuouDestinatario.forEach((v) => u.append(F.atuouDestinatario, v));
  return u.toString();
}

export function mergeFiltersFromSearchParams(
  sp: URLSearchParams,
  base: Comercial360FilterState,
): Comercial360FilterState {
  const collect = (key: string) => {
    const out: string[] = [];
    const k = key.toLowerCase();
    for (const [pk, val] of sp.entries()) {
      if (pk.toLowerCase() !== k) continue;
      const t = val.trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  };
  const def = defaultComercial360Period();
  const from = sp.get("from")?.trim() || base.from || def.from;
  const to = sp.get("to")?.trim() || base.to || def.to;
  return {
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : def.from,
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : def.to,
    mensalista: collect(F.mensalista),
    temContrato: collect(F.temContrato),
    cidade: collect(F.cidadeUf),
    statusAtividade: collect(F.statusAtividade),
    categoria: collect(F.categoria),
    tipoDocumento: collect(F.tipoDocumento),
    atuouTomador: collect(F.atuouTomador),
    atuouRemetente: collect(F.atuouRemetente),
    atuouDestinatario: collect(F.atuouDestinatario),
  };
}
