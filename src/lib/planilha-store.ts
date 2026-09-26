import { useSyncExternalStore } from "react";
import seed from "@/data/vila-da-folha-atividades.json";
import { QUICK, isOpen, normalize, type Atividade } from "@/lib/vila-da-folha";

/** Preset filter applied when a sidebar tab is clicked. */
export type Preset = { id: string; label: string; test: (a: Atividade) => boolean };

const within = (a: Atividade, days: number) => {
  if (!a.prazo) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = (+a.prazo - +t) / 864e5;
  return d >= -1 && d <= days;
};

export const PRESETS: Record<string, Preset> = {
  "/vila-da-folha": { id: "todas", label: "Todas as atividades", test: () => true },
  "/dashboard": { id: "semana", label: "Prazo nesta semana", test: (a) => within(a, 7) },
  "/campaigns": { id: "abertas", label: "Em aberto", test: isOpen },
  "/leads": { id: "alta", label: "Alta prioridade em aberto", test: QUICK.altaAberta },
  "/tools": { id: "todas", label: "Todas as atividades", test: () => true },
  "/calendar": { id: "comPrazo", label: "Com prazo definido", test: (a) => !!a.prazo },
  "/requests": { id: "atrasadas", label: "Atrasadas", test: QUICK.atrasadas },
  "/templates": { id: "concluidas", label: "Concluídas", test: QUICK.concluidas },
};
export const presetFor = (path: string) =>
  PRESETS[Object.keys(PRESETS).find((k) => path.startsWith(k)) ?? "/vila-da-folha"];

type State = {
  data: Atividade[];
  fonte: string;
  itemId: string | null;
  preset: Preset;
  chips: { status: string; categoria: string; responsavel: string };
};

let state: State = {
  data: normalize(seed as Record<string, unknown>[]),
  fonte: "Projeto_Hokage.xlsm (cópia local)",
  itemId: null,
  preset: PRESETS["/vila-da-folha"],
  chips: { status: "", categoria: "", responsavel: "" },
};
const subs = new Set<() => void>();
export function setPlanilha(p: Partial<State>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
export function usePlanilha() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => state,
  );
}
export function filtered(s: State) {
  return s.data.filter(
    (a) =>
      s.preset.test(a) &&
      (!s.chips.status || a.status === s.chips.status) &&
      (!s.chips.categoria || a.categoria === s.chips.categoria) &&
      (!s.chips.responsavel || a.responsavel === s.chips.responsavel),
  );
}
export const ITEM_KEY = "vdf-excel-item";

/** Sidebar tabs built from the spreadsheet. */
export const ABAS: { id: string; label: string; preset: Preset }[] = [
  { id: "todas", label: "Todas as atividades", preset: PRESETS["/vila-da-folha"] },
  { id: "abertas", label: "Em aberto", preset: PRESETS["/campaigns"] },
  { id: "semana", label: "Prazo da semana", preset: PRESETS["/dashboard"] },
  { id: "atrasadas", label: "Atrasadas", preset: PRESETS["/requests"] },
  { id: "alta", label: "Alta prioridade", preset: PRESETS["/leads"] },
  { id: "semResp", label: "Sem responsável", preset: { id: "semResp", label: "Sem responsável", test: QUICK.semResp } },
  { id: "concluidas", label: "Concluídas", preset: PRESETS["/templates"] },
];
