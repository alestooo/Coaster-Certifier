/**
 * Piezas del taller que viajan en su propio archivo: no frenan la primera
 * vista del taller y se precargan en reposo apenas está a la vista. Así se
 * abren al instante y siguen andando si después se corta la red o se publica
 * una versión nueva (cuyos archivos viejos ya no existen).
 */
import { LazyModule } from "./lazy-module.svelte";

export const workshopParts = {
  passengerEditor: new LazyModule(() => import("../components/workshop/PassengerEditor.svelte")),
  report: new LazyModule(() => import("../components/lab/ReportDialog.svelte")),
  guide: new LazyModule(() => import("../components/Guide.svelte")),
  fixPopover: new LazyModule(() => import("../components/workshop/FixPopover.svelte")),
  charts: new LazyModule(() => import("../components/lab/ChartCard.svelte"))
};

/** Empieza a descargar todas las piezas; una que falle se reintenta al pedirla. */
export function prefetchWorkshopParts(): void {
  for (const part of Object.values(workshopParts)) void part.load();
}
