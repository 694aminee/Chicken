import type { DisciplineId } from "@/data/disciplines";

export type HotspotId = "reformer" | "boxe" | "aquabike" | "cross";

/** Points d'intérêt cliquables de la visite 3D (positions en mètres dans la pièce). */
export const HOTSPOTS: {
  id: HotspotId;
  discipline: DisciplineId;
  label: string;
  /** Où se place l'étiquette cliquable. */
  pin: [number, number, number];
  /** Point que la caméra vise quand on choisit cet équipement. */
  focus: [number, number, number];
  /** Cercle lumineux au sol (x, z) et son rayon. */
  ring: [number, number];
  ringRadius: number;
}[] = [
  { id: "reformer", discipline: "reformer", label: "Reformer", pin: [-2.1, 0.9, -1.4], focus: [-2.4, 0.5, -1.8], ring: [-2.4, -1.8], ringRadius: 1.75 },
  { id: "boxe", discipline: "boxe", label: "Boxe", pin: [1.0, 1.9, -2.3], focus: [1.0, 1.3, -2.3], ring: [1.0, -2.3], ringRadius: 1.35 },
  { id: "aquabike", discipline: "aquabike", label: "Aquabike", pin: [-2.2, 1.5, 3.1], focus: [-2.2, 1.0, 2.45], ring: [-2.2, 2.45], ringRadius: 1.8 },
  { id: "cross", discipline: "cross", label: "Cross Training", pin: [3.2, 1.1, -3.1], focus: [3.0, 0.6, -2.2], ring: [3.0, -2.4], ringRadius: 1.3 },
];
