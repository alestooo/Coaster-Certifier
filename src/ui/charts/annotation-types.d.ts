import type { ChartType } from "chart.js";

/** Línea horizontal de referencia. */
export interface HorizontalLine {
  value: number;
  label: string;
  color?: string;
}

/** Banda horizontal sombreada (p. ej. intervalo de carga permitido). */
export interface HorizontalBand {
  from: number;
  to: number;
  color?: string;
}

/** Marcador vertical (punto crítico o evento). */
export interface VerticalMarker {
  x: number;
  label: string;
  color?: string;
  dashed?: boolean;
}

/** Banda vertical de fondo que identifica un tramo del trazado. */
export interface SectionBand {
  from: number;
  to: number;
  label: string;
  color?: string;
}

/** Opciones que lee el plugin `coasterAnnotations`. */
export interface CoasterAnnotations {
  horizontalLines?: HorizontalLine[];
  band?: HorizontalBand | null;
  markers?: VerticalMarker[];
  events?: VerticalMarker[];
  sections?: SectionBand[];
}

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    coasterAnnotations?: CoasterAnnotations;
  }
}
