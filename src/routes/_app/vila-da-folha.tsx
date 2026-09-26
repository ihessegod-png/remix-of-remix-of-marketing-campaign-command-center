import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import capa from "@/assets/vila-da-folha-capa-v2.jpg.asset.json";
import seed from "@/data/vila-da-folha-atividades.json";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import {
  ALERTS, QUICK, count, download, fmtBRL, fmtDate, fmtDec, fmtPct, isOpen, kpis, normalize, parseWorkbook,
  type Atividade, type Quick,
} from "@/lib/vila-da-folha";

export const Route = createFileRoute("/_app/vila-da-folha")({
  component: VilaDaFolha,
  head: () => ({
    meta: [
      { title: "Vila da Folha — Command Center" },
      { name: "description", content: "Painel executivo de atividades: KPIs, alertas, gráficos e tabela operacional." },
      { property: "og:title", content: "Vila da Folha — Command Center" },
      { property: "og:description", content: "Painel executivo de atividades com KPIs, alertas e gráficos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const C = ["var(--destructive)", "var(--primary)", "var(--accent)", "var(--muted-foreground)", "var(--foreground)"];
type Filters = { de: string; ate: string; categoria: string; cliente: string; responsavel: string; status: string; prioridade: string };
const EMPTY: Filters = { de: "", ate: "", categoria: "", cliente: "", responsavel: "", status: "", prioridade: "" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" } };

function VilaDaFolha() {
  const [data, setData] = useState<Atividade[]>(() => normalize(seed as Record<string, unknown>[]));
  const [fonte, setFonte] = useState("Projeto_Hokage.xlsm");
  const [f, setF] = useState<Filters>(EMPTY);
  const [quick, setQuick] = useState<Quick | null>(null);
  const [modo, setModo] = useState<"EXECUTIVO" | "OPERACIONAL">("EXECUTIVO");
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<{ k: keyof Atividade; asc: boolean }>({ k: "id", asc: true });
  const fileRef = useRef<HTMLInputElement>(null);

  const opts = useMemo(() => {
    const u = (k: keyof Atividade) => [...new Set(data.map((a) => String(a[k])))].sort();
    return { categoria: u("categoria"), cliente: u("cliente"), responsavel: u("responsavel"), status: u("status"), prioridade: u("prioridade") };
  }, [data]);

  const filtered = useMemo(() => data.filter((a) => {
    if (f.de && (!a.inicio || a.inicio < new Date(f.de))) return false;
    if (f.ate && (!a.inicio || a.inicio > new Date(f.ate + "T23:59"))) return false;
    for (const k of ["categoria", "cliente", "responsavel", "status", "prioridade"] as const) if (f[k] && a[k] !== f[k]) return false;
    return true;
  }), [data, f]);

  const k = kpis(filtered);
  const toggle = (q: Quick) => setQuick((c) => (c === q ? null : q));
  const setFilter = (key: keyof Filters, v: string) => setF((p) => ({ ...p, [key]: p[key] === v ? "" : v }));
  const clear = () => { setF(EMPTY); setQuick(null); setBusca(""); };

  const tableRows = useMemo(() => {
    let r = quick ? filtered.filter(QUICK[quick]) : filtered;
    const s = busca.trim().toLowerCase();
    if (s) r = r.filter((a) => [a.id, a.atividade, a.categoria, a.cliente, a.responsavel, a.status].join(" ").toLowerCase().includes(s));
    return [...r].sort((x, y) => {
      const a = x[sort.k], b = y[sort.k];
      const va = a instanceof Date ? +a : a ?? "", vb = b instanceof Date ? +b : b ?? "";
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [filtered, quick, busca, sort]);

  const onUpload = async (file?: File) => {
    if (!file) return;
    try {
      const rows = parseWorkbook(await file.arrayBuffer());
      setData(rows); setFonte(file.name); clear();
      toast.success(`${rows.length} atividades importadas de ${file.name}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  // Chart data
  const byStatus = count(filtered, "status"), byCat = count(filtered, "categoria"), byPri = count(filtered, "prioridade");
  const byCli = count(filtered, "cliente").slice(0, 10).map((d) => ({ ...d, short: d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name }));
  const byResp = [...new Set(filtered.map((a) => a.responsavel))].map((r) => {
    const rs = filtered.filter((a) => a.responsavel === r);
    return { name: r, Concluídas: rs.filter((a) => !isOpen(a)).length, "Em aberto": rs.filter(isOpen).length, t: rs.length };
  }).sort((a, b) => b.t - a.t);
  const evol = (() => {
    const m = new Map<string, number>();
    filtered.forEach((a) => a.inicio && m.set(a.inicio.toISOString().slice(0, 10), (m.get(a.inicio.toISOString().slice(0, 10)) ?? 0) + 1));
    let acc = 0;
    return [...m.entries()].sort().map(([d, n]) => ({ dia: d.slice(8, 10) + "/" + d.slice(5, 7), Novas: n, Acumulado: (acc += n) }));
  })();
  const done = filtered.filter((a) => !isOpen(a));
  const sla = [
    { name: "Concluídas no prazo", value: done.filter((a) => a.noPrazo).length },
    { name: "Concluídas fora do prazo", value: done.filter((a) => !a.noPrazo).length },
    { name: "Abertas atrasadas", value: filtered.filter((a) => isOpen(a) && a.atrasada).length },
    { name: "Abertas em dia", value: filtered.filter((a) => isOpen(a) && !a.atrasada).length },
  ];
  const horas = [...new Set(filtered.map((a) => a.categoria))].map((c) => {
    const rs = filtered.filter((a) => a.categoria === c);
    return { name: c, Estimadas: +rs.reduce((s, a) => s + a.horasEst, 0).toFixed(1), Realizadas: +rs.reduce((s, a) => s + a.horasReal, 0).toFixed(1) };
  });

  const KPIS: { label: string; value: string; q?: Quick }[] = [
    { label: "Total de atividades", value: String(k.total), q: undefined },
    { label: "Concluídas", value: String(k.concluidas), q: "concluidas" },
    { label: "Em aberto", value: String(k.abertas), q: "abertas" },
    { label: "Atrasadas", value: String(k.atrasadas), q: "atrasadas" },
    { label: "% conclusão", value: fmtPct(k.pctConclusao) },
    { label: "% no prazo (SLA)", value: fmtPct(k.pctNoPrazo), q: "noPrazo" },
    { label: "Horas estimadas", value: fmtDec(k.horasEst) },
    { label: "Horas realizadas", value: fmtDec(k.horasReal) },
    { label: "Eficiência de horas", value: fmtPct(k.eficiencia) },
    { label: "Lead time médio (dias)", value: fmtDec(k.leadTime) },
    { label: "Valor/Receita", value: fmtBRL(k.valor) },
  ];

  const sel = "h-9 rounded-md border border-border bg-background/60 px-2 text-sm text-foreground";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-destructive bg-destructive/20 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-6 px-4 pb-12 sm:px-6">
      {/* Capa */}
      <section className="relative -mx-4 overflow-hidden bg-background sm:-mx-6">
        <img src={capa.url} alt="Lua carmesim com silhueta ninja e corvos" className="absolute inset-y-0 right-0 h-full w-full object-contain object-right sm:w-auto" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 via-45% to-transparent to-70%" />
        <div className="relative flex min-h-[380px] flex-col justify-end gap-3 px-6 py-10 sm:px-10">
          <div className="text-xs uppercase tracking-[0.3em] text-destructive">Command Center</div>
          <h1 className="font-display text-5xl tracking-tight text-foreground sm:text-6xl">Vila da Folha</h1>
          <p className="max-w-lg text-sm text-muted-foreground">Painel executivo de atividades — KPIs, alertas, gráficos e visão operacional, calculados direto da sua planilha.</p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {(["EXECUTIVO", "OPERACIONAL"] as const).map((m) => (
              <button key={m} onClick={() => setModo(m)} className={chip(modo === m)}>{m}</button>
            ))}
            <button onClick={() => fileRef.current?.click()} className={chip(false)}>⬆ Reimportar base (.xlsm)</button>
            <input ref={fileRef} type="file" accept=".xlsm,.xlsx" hidden onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
            <span className="text-xs text-muted-foreground">Fonte: {fonte} · {data.length} atividades</span>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <GlassPanel className="flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1 text-xs text-muted-foreground">Início de<input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} className={sel} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">até<input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} className={sel} /></label>
        {(["categoria", "cliente", "responsavel", "status", "prioridade"] as const).map((key) => (
          <label key={key} className="grid gap-1 text-xs capitalize text-muted-foreground">
            {key === "responsavel" ? "Responsável" : key === "cliente" ? "Cliente/Conta" : key}
            <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={`${sel} max-w-[200px]`}>
              <option value="">Todos</option>
              {opts[key].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
        <button onClick={clear} className="h-9 rounded-md border border-destructive/50 px-3 text-sm text-foreground hover:bg-destructive/15">Limpar filtros</button>
      </GlassPanel>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {KPIS.map((x) => {
          const on = x.q ? quick === x.q : x.label.startsWith("Total") && quick === null;
          return (
            <button key={x.label} disabled={!x.q && !x.label.startsWith("Total")}
              onClick={() => (x.q ? toggle(x.q) : setQuick(null))}
              className={`rounded-xl border p-4 text-left transition ${on && (x.q || quick === null) && x.q ? "border-destructive bg-destructive/15 shadow-[0_0_24px_-6px_var(--destructive)]" : "border-border bg-card/60 enabled:hover:border-destructive/60"}`}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{x.label}</div>
              <div className="mt-1 font-display text-2xl text-foreground">{x.value}</div>
            </button>
          );
        })}
      </div>
      {quick && <div className="text-xs text-muted-foreground">Atalho ativo: <b className="text-foreground">{quick}</b> — aplicado à tabela. <button className="underline" onClick={() => setQuick(null)}>remover</button></div>}

      {/* Alertas */}
      <GlassPanel className="p-4">
        <h2 className="mb-3 font-display text-lg text-foreground">Alertas executivos</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ALERTS.map((a) => {
            const n = filtered.filter(QUICK[a.q]).length;
            return (
              <button key={a.q} disabled={!n} onClick={() => { setQuick(a.q); setModo("OPERACIONAL"); }}
                className={`rounded-lg border p-3 text-left transition disabled:opacity-40 ${a.sev === "alta" && n ? "border-destructive/60 bg-destructive/10" : "border-border bg-background/40"} enabled:hover:border-destructive`}>
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-foreground">{a.titulo}</span><span className="font-display text-xl text-foreground">{n}</span></div>
                <div className="text-xs text-muted-foreground">{a.detalhe}</div>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Atividades por Status">
          <PieChart><Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} onClick={(d) => setFilter("status", d.name as string)} className="cursor-pointer">
            {byStatus.map((d, i) => <Cell key={d.name} fill={C[i % C.length]} stroke="var(--background)" />)}</Pie><Tooltip {...tip} /><Legend /></PieChart>
        </ChartCard>
        <ChartCard title="Atividades por Categoria">
          <BarChart data={byCat}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} /><YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="value" name="Atividades" fill="var(--destructive)" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(d) => setFilter("categoria", (d as { name: string }).name)} /></BarChart>
        </ChartCard>
        <ChartCard title="Ranking de Responsáveis">
          <BarChart data={byResp} layout="vertical"><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><YAxis type="category" dataKey="name" width={100} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip {...tip} cursor={{ fill: "var(--muted)" }} /><Legend />
            <Bar dataKey="Concluídas" stackId="a" fill="var(--primary)" className="cursor-pointer" onClick={(d) => setFilter("responsavel", (d as { name: string }).name)} />
            <Bar dataKey="Em aberto" stackId="a" fill="var(--destructive)" className="cursor-pointer" onClick={(d) => setFilter("responsavel", (d as { name: string }).name)} /></BarChart>
        </ChartCard>
        <ChartCard title="Ranking de Clientes/Contas">
          <BarChart data={byCli} layout="vertical"><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><YAxis type="category" dataKey="short" width={170} stroke="var(--muted-foreground)" fontSize={10} /><Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="value" name="Atividades" fill="var(--accent)" className="cursor-pointer" onClick={(d) => setFilter("cliente", (d as { name: string }).name)} /></BarChart>
        </ChartCard>
        <ChartCard title="Evolução das atividades">
          <ComposedChart data={evol}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} /><YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip {...tip} /><Legend />
            <Bar dataKey="Novas" fill="var(--destructive)" radius={[4, 4, 0, 0]} /><Line dataKey="Acumulado" stroke="var(--primary)" strokeWidth={2} dot /></ComposedChart>
        </ChartCard>
        <ChartCard title="Performance de Prazo / SLA">
          <BarChart data={sla}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} /><YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="value" name="Atividades" radius={[4, 4, 0, 0]}>{sla.map((d, i) => <Cell key={d.name} fill={["var(--primary)", "var(--accent)", "var(--destructive)", "var(--muted-foreground)"][i]} />)}</Bar></BarChart>
        </ChartCard>
        <ChartCard title="Horas estimadas x realizadas por categoria">
          <ComposedChart data={horas}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} /><YAxis stroke="var(--muted-foreground)" fontSize={11} /><Tooltip {...tip} /><Legend />
            <Area dataKey="Estimadas" fill="var(--primary)" fillOpacity={0.25} stroke="var(--primary)" /><Bar dataKey="Realizadas" fill="var(--destructive)" radius={[4, 4, 0, 0]} /></ComposedChart>
        </ChartCard>
        <ChartCard title="Distribuição por Prioridade">
          <PieChart><Pie data={byPri} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} onClick={(d) => setFilter("prioridade", d.name as string)} className="cursor-pointer">
            {byPri.map((d, i) => <Cell key={d.name} fill={C[i % C.length]} stroke="var(--background)" />)}</Pie><Tooltip {...tip} /><Legend /></PieChart>
        </ChartCard>
      </div>

      {/* Tabela operacional */}
      {modo === "OPERACIONAL" && (
        <GlassPanel className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-display text-lg text-foreground">Tabela operacional · {tableRows.length}</h2>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className={`${sel} w-56`} />
            <button onClick={() => download(tableRows, "csv")} className={chip(false)}>Exportar CSV</button>
            <button onClick={() => download(tableRows, "xlsx")} className={chip(false)}>Exportar Excel</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {([["id", "ID"], ["atividade", "Atividade"], ["categoria", "Categoria"], ["cliente", "Cliente"], ["responsavel", "Responsável"], ["status", "Status"], ["prioridade", "Prioridade"], ["prazo", "Prazo"], ["pct", "% concl."], ["horasEst", "H. est."], ["horasReal", "H. real."], ["leadTime", "Lead time"], ["valor", "Valor"]] as [keyof Atividade, string][]).map(([key, l]) => (
                  <th key={key} className="cursor-pointer whitespace-nowrap px-2 py-2 hover:text-foreground" onClick={() => setSort((s) => ({ k: key, asc: s.k === key ? !s.asc : true }))}>
                    {l}{sort.k === key ? (sort.asc ? " ▲" : " ▼") : ""}</th>))}
              </tr></thead>
              <tbody>{tableRows.map((a) => (
                <tr key={a.id} className="border-b border-border/50 text-foreground hover:bg-muted/40">
                  <td className="px-2 py-2 font-mono text-xs">{a.id}</td><td className="max-w-[220px] truncate px-2" title={a.atividade}>{a.atividade}</td>
                  <td className="px-2">{a.categoria}</td><td className="max-w-[200px] truncate px-2" title={a.cliente}>{a.cliente}</td><td className="px-2">{a.responsavel}</td>
                  <td className="px-2"><span className={`rounded-full px-2 py-0.5 text-xs ${isOpen(a) ? (a.atrasada ? "bg-destructive/25" : "bg-muted") : "bg-primary/20"}`}>{a.status}</span></td>
                  <td className="px-2">{a.prioridade}</td><td className="whitespace-nowrap px-2">{fmtDate(a.prazo)}</td><td className="px-2">{fmtPct(a.pct)}</td>
                  <td className="px-2">{fmtDec(a.horasEst)}</td><td className="px-2">{fmtDec(a.horasReal)}</td><td className="px-2">{fmtDec(a.leadTime)}</td><td className="whitespace-nowrap px-2">{fmtBRL(a.valor)}</td>
                </tr>))}
                {!tableRows.length && <tr><td colSpan={13} className="py-8 text-center text-muted-foreground">Nenhuma atividade para os filtros atuais.</td></tr>}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <GlassPanel className="p-4">
      <h3 className="mb-2 text-sm font-medium text-foreground">{title}</h3>
      <div className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </GlassPanel>
  );
}
