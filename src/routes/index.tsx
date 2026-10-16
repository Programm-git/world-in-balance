import { createFileRoute } from "@tanstack/react-router";
import { WarRoom } from "@/components/warroom/WarRoom";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Situationszentrum – Geopolitik-Kriegssimulator" },
      { name: "description", content: "Echtzeit-War-Room: Führen Sie Ihre Nation durch Eskalation, Bunkerbau, Luftkrieg und nukleare Abschreckung." },
      { property: "og:title", content: "Situationszentrum – Geopolitik-Kriegssimulator" },
      { property: "og:description", content: "Echtzeit-War-Room mit 3D-Globus, KI-Nationen, Zivilschutz und Moral." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WarRoom,
});
