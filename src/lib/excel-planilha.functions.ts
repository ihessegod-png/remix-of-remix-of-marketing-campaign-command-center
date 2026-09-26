import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/microsoft_excel";

async function graph<T>(path: string): Promise<T> {
  const lk = process.env["LOVABLE_API_KEY"];
  const ck = process.env["MICROSOFT_EXCEL_API_KEY"];
  if (!lk || !ck) throw new Error("Excel online não está conectado.");
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Excel request failed [${res.status}]: ${body}`);
    throw new Error(`Excel respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

type Item = { id: string; name: string; lastModifiedDateTime?: string; file?: unknown };

export const listExcelFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const seen = new Map<string, { id: string; name: string; modificado: string | null }>();
    for (const q of [".xlsx", ".xlsm"]) {
      const r = await graph<{ value: Item[] }>(`/me/drive/root/search(q='${q}')?$top=100`);
      for (const it of r.value) {
        if (it.file && /\.xls[xm]$/i.test(it.name)) {
          seen.set(it.id, { id: it.id, name: it.name, modificado: it.lastModifiedDateTime ?? null });
        }
      }
    }
    return [...seen.values()].sort((a, b) => (b.modificado ?? "").localeCompare(a.modificado ?? ""));
  });

export const readExcelActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().min(1).max(200).regex(/^[A-Za-z0-9!._-]+$/) }).parse(d))
  .handler(async ({ data }) => {
    const base = `/me/drive/items/${data.itemId}/workbook`;
    const ws = await graph<{ value: { name: string }[] }>(`${base}/worksheets?$select=name`);
    const sheet = ws.value.find((w) => w.name.trim().toLowerCase() === "atividades") ?? ws.value[0];
    if (!sheet) throw new Error("A planilha não tem abas.");
    const range = await graph<{ values: unknown[][] }>(
      `${base}/worksheets('${encodeURIComponent(sheet.name.replace(/'/g, "''"))}')/usedRange(valuesOnly=true)?$select=values`,
    );
    const grid = range.values ?? [];
    const h = grid.findIndex((r) => String(r?.[0] ?? "").trim() === "ID");
    if (h < 0) throw new Error(`Cabeçalho com 'ID' na coluna A não encontrado na aba ${sheet.name}.`);
    const head = grid[h].map((c) => String(c ?? "").trim());
    const rows = grid
      .slice(h + 1)
      .map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] === "" ? null : r[i]])));
    return { aba: sheet.name, rows: JSON.parse(JSON.stringify(rows)) as Record<string, string | number | boolean | null>[] };
  });
