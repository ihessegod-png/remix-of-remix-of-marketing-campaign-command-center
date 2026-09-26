import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import { z } from "zod";
import { PlanilhaHexGrid } from "@/components/vila/PlanilhaHexGrid";
import { ABAS, setPlanilha } from "@/lib/planilha-store";

export const Route = createFileRoute("/_app/planilha")({
  validateSearch: zodValidator(z.object({ aba: fallback(z.string(), "todas").default("todas") })),
  component: PlanilhaPage,
  head: () => ({
    meta: [
      { title: "Atividades da planilha — Vila da Folha" },
      { name: "description", content: "Atividades da planilha em hexágonos, filtradas por status, prazo e prioridade." },
      { property: "og:title", content: "Atividades da planilha — Vila da Folha" },
      { property: "og:description", content: "Cada atividade da planilha vira um hexágono colorido pelo status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PlanilhaPage() {
  const { aba } = Route.useSearch();
  useEffect(() => {
    setPlanilha({ preset: (ABAS.find((a) => a.id === aba) ?? ABAS[0]).preset });
  }, [aba]);
  return (
    <div className="py-8">
      <PlanilhaHexGrid />
    </div>
  );
}
