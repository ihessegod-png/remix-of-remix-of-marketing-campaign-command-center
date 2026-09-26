import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listExcelFiles, readExcelActivities } from "@/lib/excel-planilha.functions";
import { ITEM_KEY, filtered, setPlanilha, usePlanilha } from "@/lib/planilha-store";
import { CONCLUIDO, count, fmtDate, normalize, type Atividade } from "@/lib/vila-da-folha";

const statusColor = (a: Atividade) => {
  if (a.status === CONCLUIDO) return "var(--hex-done)";
  if (a.atrasada) return "var(--hex-late)";
  if (/andamento|execu/i.test(a.status)) return "var(--hex-doing)";
  return "var(--hex-todo)";
};

const HEX = "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)";

export function PlanilhaHexGrid() {
  const s = usePlanilha();
  const list = useMemo(() => filtered(s), [s]);
  const listFiles = useServerFn(listExcelFiles);
  const readFile = useServerFn(readExcelActivities);
  const [files, setFiles] = useState<{ id: string; name: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Atividade | null>(null);
  const [gone, setGone] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [offs, setOffs] = useState<Record<string, { dx: number; dy: number; rot: number; order: number }>>({});
  useEffect(() => {
    if (!sel) { setGone(false); return; }
    const t = setTimeout(() => setGone(true), 1500);
    return () => clearTimeout(t);
  }, [sel]);
  const pickHex = (a: Atividade) => {
    setGone(false);
    if (sel?.id === a.id) { setSel(null); return; }
    const root = gridRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-hex="${a.id}"]`)?.getBoundingClientRect();
    const next: typeof offs = {};
    if (root && target) {
      const els = Array.from(root.querySelectorAll<HTMLElement>("[data-hex]"));
      const items = els.map((el) => {
        const r = el.getBoundingClientRect();
        const dx = target.left - r.left, dy = target.top - r.top;
        return { id: el.dataset.hex!, dx, dy, d: Math.hypot(dx, dy) };
      }).sort((x, y) => x.d - y.d);
      items.forEach((it, k) => { next[it.id] = { dx: it.dx, dy: it.dy, rot: 540 + Math.round(it.d / 2), order: k }; });
    }
    setOffs(next);
    setSel(a);
  };

  async function load(itemId: string, name?: string) {
    setLoading(true);
    try {
      const r = await readFile({ data: { itemId } });
      const data = normalize(r.rows);
      localStorage.setItem(ITEM_KEY, JSON.stringify({ itemId, name }));
      setPlanilha({ data, itemId, fonte: `${name ?? "Excel online"} · aba ${r.aba}` });
      toast.success(`${data.length} atividades carregadas do Excel`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler a planilha");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const raw = localStorage.getItem(ITEM_KEY);
    if (raw && !s.itemId) {
      try { const v = JSON.parse(raw); if (v.itemId) void load(v.itemId, v.name); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick() {
    setLoading(true);
    try { setFiles(await listFiles()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao listar planilhas"); }
    finally { setLoading(false); }
  }

  const chip = (k: "status" | "categoria" | "responsavel", label: string) => (
    <select
      value={s.chips[k]}
      onChange={(e) => setPlanilha({ chips: { ...s.chips, [k]: e.target.value } })}
      className="rounded-full border border-glass-border bg-glass/40 px-3 py-1.5 text-xs text-foreground"
    >
      <option value="">{label}: todos</option>
      {count(s.data, k).map((o) => <option key={o.name} value={o.name}>{o.name} ({o.value})</option>)}
    </select>
  );

  return (
    <section className="relative z-10 px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Planilha · {s.fonte}</div>
          <h2 className="mt-1 font-display text-2xl">
            {s.preset.label} <span className="text-primary">· {list.length}</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chip("status", "Status")}
          {chip("categoria", "Categoria")}
          {chip("responsavel", "Responsável")}
          {s.itemId && (
            <button onClick={() => load(s.itemId!)} disabled={loading} className="rounded-full border border-glass-border px-3 py-1.5 text-xs hover:border-primary/50">
              Atualizar
            </button>
          )}
          <button onClick={pick} disabled={loading} className="rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25">
            {loading ? "Carregando…" : "Escolher planilha do Excel"}
          </button>
        </div>
      </div>

      {files && (
        <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-glass-border bg-glass/40 p-2">
          {files.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhuma planilha .xlsx/.xlsm encontrada no seu OneDrive.</p>}
          {files.map((f) => (
            <button key={f.id} onClick={() => { setFiles(null); void load(f.id, f.name); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-glass-strong">
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div ref={gridRef} className="mt-6 flex flex-wrap gap-x-1 gap-y-0 pl-6">
        {list.filter((a) => !(sel && gone && a.id !== sel.id)).map((a, i) => {
          const o = offs[a.id];
          const pulled = sel && a.id !== sel.id;
          return (
          <button
            key={a.id}
            data-hex={a.id}
            onClick={() => pickHex(a)}
            title={`${a.id} · ${a.atividade}`}
            className="relative h-[104px] w-[92px] transition hover:scale-110 focus:scale-110"
            style={{
              clipPath: HEX, background: statusColor(a),
              marginTop: sel && gone ? 0 : i % 2 ? 52 : 0,
              pointerEvents: pulled ? "none" : undefined,
              zIndex: sel?.id === a.id ? 20 : pulled ? 1 : undefined,
              ["--dx" as string]: `${o?.dx ?? 0}px`,
              ["--dy" as string]: `${o?.dy ?? 0}px`,
              ["--rot" as string]: `${o?.rot ?? 540}deg`,
              animation: pulled
                ? `kamui 1s ${(o?.order ?? 0) * 60}ms cubic-bezier(.5,0,.75,.2) forwards`
                : sel ? "kamui-core 1.2s ease-out" : `hex-pop .4s ${Math.min(i, 40) * 25}ms both`,
            }}
          >
            <span className="absolute inset-[2px] flex flex-col items-center justify-center bg-background/55 px-2 text-center" style={{ clipPath: HEX }}>
              <span className="text-[10px] font-semibold">{a.id}</span>
              <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{a.atividade}</span>
            </span>
          </button>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade com esses filtros.</p>}
      </div>

      <div className="mt-16 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        {[["--hex-done", "Concluída"], ["--hex-doing", "Em andamento"], ["--hex-todo", "A fazer / outros"], ["--hex-late", "Atrasada"]].map(([v, l]) => (
          <span key={v} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: `var(${v})` }} />{l}</span>
        ))}
      </div>

      {sel && (
        <div className="mt-4 rounded-xl border border-glass-border bg-glass/50 p-4 text-sm">
          <div className="flex justify-between"><b>{sel.id} · {sel.atividade}</b><button onClick={() => setSel(null)} className="text-muted-foreground">fechar</button></div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-4">
            <span>Status: {sel.status}</span><span>Prioridade: {sel.prioridade}</span>
            <span>Cliente: {sel.cliente}</span><span>Responsável: {sel.responsavel}</span>
            <span>Categoria: {sel.categoria}</span><span>Prazo: {fmtDate(sel.prazo)}</span>
            <span>Conclusão: {Math.round(sel.pct * 100)}%</span><span>Horas: {sel.horasReal}/{sel.horasEst}</span>
          </div>
        </div>
      )}
    </section>
  );
}
