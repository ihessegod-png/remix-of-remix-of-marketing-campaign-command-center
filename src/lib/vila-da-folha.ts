import * as XLSX from "xlsx";

export type Atividade = {
  id: string;
  atividade: string;
  categoria: string;
  cliente: string;
  responsavel: string;
  status: string;
  prioridade: string;
  valor: number;
  inicio: Date | null;
  prazo: Date | null;
  pct: number;
  horasEst: number;
  horasReal: number;
  leadTime: number | null;
  atrasada: boolean;
  semResp: boolean;
  noPrazo: boolean;
};

export const VAZIO = "Não informado";
export const CONCLUIDO = "Concluído";

const txt = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return s && s !== "nan" && s !== "None" ? s : VAZIO;
};
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const dt = (v: unknown): Date | null => {
  if (v == null || v === "" || v === "None" || v === "NaT") return null;
  if (v instanceof Date) return isNaN(+v) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(d.y, d.m - 1, d.d, d.H, d.M) : null;
  }
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(+d) ? null : d;
};
const sim = (v: unknown) => String(v ?? "").trim().toLowerCase() === "sim";

export function normalize(rows: Record<string, unknown>[]): Atividade[] {
  return rows
    .filter((r) => r["ID"] != null && String(r["ID"]).trim() !== "")
    .map((r) => {
      const resp = txt(r["Responsável principal"]);
      const lt = r["Lead time (dias)"];
      return {
        id: String(r["ID"]).trim(),
        atividade: txt(r["Atividade"]),
        categoria: txt(r["Categoria"]),
        cliente: txt(r["Cliente/Conta"]),
        responsavel: resp,
        status: txt(r["Status"]),
        prioridade: txt(r["Prioridade"]),
        valor: num(r["Valor/Receita (R$)"]),
        inicio: dt(r["Data de início"]),
        prazo: dt(r["Data de conclusão/prazo"]),
        pct: num(r["% conclusão"]),
        horasEst: num(r["Horas estimadas"]),
        horasReal: num(r["Horas realizadas"]),
        leadTime: lt == null || lt === "" ? null : num(lt),
        atrasada: sim(r["Atrasada?"]),
        semResp: sim(r["Sem responsável?"]) || resp === VAZIO,
        noPrazo: sim(r["No prazo?"]),
      };
    });
}

/** Reads the "Atividades" sheet; header row is detected by "ID" in column A. */
export function parseWorkbook(buf: ArrayBuffer): Atividade[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets["Atividades"] ?? wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const h = grid.findIndex((r) => String(r?.[0] ?? "").trim() === "ID");
  if (h < 0) throw new Error("Cabeçalho com 'ID' na coluna A não encontrado na aba Atividades.");
  const head = (grid[h] as unknown[]).map((c) => String(c ?? "").trim());
  const rows = grid.slice(h + 1).map((r) => Object.fromEntries(head.map((k, i) => [k, (r as unknown[])[i]])));
  return normalize(rows);
}

export const isOpen = (a: Atividade) => a.status !== CONCLUIDO;
const div = (a: number, b: number) => (b ? a / b : null);

export function kpis(d: Atividade[]) {
  const done = d.filter((a) => !isOpen(a));
  const est = d.reduce((s, a) => s + a.horasEst, 0);
  const real = d.reduce((s, a) => s + a.horasReal, 0);
  const lts = d.map((a) => a.leadTime).filter((v): v is number => v != null);
  return {
    total: d.length,
    concluidas: done.length,
    abertas: d.length - done.length,
    atrasadas: d.filter((a) => a.atrasada).length,
    pctConclusao: div(done.length, d.length),
    pctNoPrazo: div(done.filter((a) => a.noPrazo).length, done.length),
    horasEst: est,
    horasReal: real,
    eficiencia: div(est, real),
    leadTime: lts.length ? lts.reduce((s, v) => s + v, 0) / lts.length : null,
    valor: d.reduce((s, a) => s + a.valor, 0),
  };
}

export type Quick = "concluidas" | "abertas" | "atrasadas" | "noPrazo" | "altaAberta" | "vencendo" | "semResp" | "vencidaSemFlag" | "estouro" | "pctInconsistente";

const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
export const QUICK: Record<Quick, (a: Atividade) => boolean> = {
  concluidas: (a) => !isOpen(a),
  abertas: isOpen,
  atrasadas: (a) => a.atrasada,
  noPrazo: (a) => !isOpen(a) && a.noPrazo,
  altaAberta: (a) => isOpen(a) && a.prioridade.toLowerCase() === "alta",
  vencendo: (a) => {
    if (!isOpen(a) || !a.prazo) return false;
    const diff = (+a.prazo - +today0()) / 864e5;
    return diff >= 0 && diff <= 3;
  },
  semResp: (a) => a.semResp,
  vencidaSemFlag: (a) => isOpen(a) && !!a.prazo && a.prazo < today0() && !a.atrasada,
  estouro: (a) => a.horasReal > a.horasEst && a.horasEst > 0,
  pctInconsistente: (a) => a.pct >= 1 && isOpen(a),
};

export const ALERTS: { q: Quick; sev: "alta" | "media"; titulo: string; detalhe: string }[] = [
  { q: "atrasadas", sev: "alta", titulo: "Atividades atrasadas", detalhe: "Sinalizadas como atrasadas na base" },
  { q: "altaAberta", sev: "alta", titulo: "Alta prioridade em aberto", detalhe: "Prioridade alta ainda não concluída" },
  { q: "vencendo", sev: "media", titulo: "Próximas do vencimento", detalhe: "Prazo nos próximos 3 dias" },
  { q: "semResp", sev: "media", titulo: "Sem responsável", detalhe: "Nenhum responsável principal definido" },
  { q: "vencidaSemFlag", sev: "alta", titulo: "Vencidas não sinalizadas", detalhe: "Prazo no passado, em aberto, sem flag Atrasada?" },
  { q: "estouro", sev: "media", titulo: "Estouro de horas", detalhe: "Horas realizadas acima das estimadas" },
  { q: "pctInconsistente", sev: "media", titulo: "% conclusão inconsistente", detalhe: "100% concluída sem status Concluído" },
];

export const count = (d: Atividade[], k: keyof Atividade) => {
  const m = new Map<string, number>();
  d.forEach((a) => m.set(String(a[k]), (m.get(String(a[k])) ?? 0) + 1));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
export const fmtDec = (v: number | null, d = 1) => (v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: d }));
export const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

export function exportRows(d: Atividade[]) {
  return d.map((a) => ({
    ID: a.id, Atividade: a.atividade, Categoria: a.categoria, Cliente: a.cliente,
    Responsável: a.responsavel, Status: a.status, Prioridade: a.prioridade, Prazo: fmtDate(a.prazo),
    "% conclusão": Math.round(a.pct * 100), "Horas estimadas": a.horasEst, "Horas realizadas": a.horasReal,
    "Lead time (dias)": a.leadTime == null ? "" : +a.leadTime.toFixed(1), "Valor/Receita (R$)": a.valor,
  }));
}

export function download(d: Atividade[], kind: "csv" | "xlsx") {
  const ws = XLSX.utils.json_to_sheet(exportRows(d));
  if (kind === "csv") {
    const blob = new Blob(["\ufeff" + XLSX.utils.sheet_to_csv(ws, { FS: ";" })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "vila-da-folha-atividades.csv" }).click();
    URL.revokeObjectURL(url);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atividades");
    XLSX.writeFile(wb, "vila-da-folha-atividades.xlsx");
  }
}
