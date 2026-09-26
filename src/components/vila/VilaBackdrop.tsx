import folha from "@/assets/vila-da-folha-fundo.jpg.asset.json";
import areia from "@/assets/vila-areia.jpg";
import nevoa from "@/assets/vila-nevoa.jpg";
import nuvem from "@/assets/vila-nuvem.jpg";
import pedra from "@/assets/vila-pedra.jpg";

const MAP: [string, string, string][] = [
  ["/vila-da-folha", folha.url, "Vila da Folha"],
  ["/planilha", pedra, "Vila da Pedra"],
  ["/dashboard", areia, "Vila da Areia"],
  ["/campaigns", nevoa, "Vila da Névoa"],
  ["/leads", nuvem, "Vila da Nuvem"],
  ["/tools", pedra, "Vila da Pedra"],
  ["/calendar", areia, "Vila da Areia"],
  ["/requests", nevoa, "Vila da Névoa"],
  ["/templates", nuvem, "Vila da Nuvem"],
  ["/welcome", folha.url, "Vila da Folha"],
  ["/settings", pedra, "Vila da Pedra"],
  ["/integrations", nuvem, "Vila da Nuvem"],
  ["/connectors", nuvem, "Vila da Nuvem"],
  ["/funnel", areia, "Vila da Areia"],
  ["/workspaces", nevoa, "Vila da Névoa"],
];

/** Fixed, dimmed village backdrop behind each app page. */
export function VilaBackdrop({ path }: { path: string }) {
  const hit = MAP.find(([p]) => path.startsWith(p)) ?? MAP[0];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        key={hit[1]}
        src={hit[1]}
        alt=""
        className="h-full w-full object-cover opacity-30 animate-[vila-fade_.8s_ease-out]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
    </div>
  );
}
