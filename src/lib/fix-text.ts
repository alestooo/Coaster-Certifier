/**
 * Textos de las correcciones verificadas: título, cambio y porqué físico.
 * Los porqués son los mismos que mostraba el diálogo de diagnóstico.
 */
import { fieldByKey } from "./field-definitions";
import type { SimulationConfig } from "./types";

export interface FixChange {
  key: string;
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
}

export interface FixOption {
  config: SimulationConfig;
  changes: FixChange[];
  /** Instante de la llegada detenida (s). */
  time: number;
  maxLoad: number;
  minLoad: number;
  /** Verdadero si la alternativa se calculó con la física del fallo antes de comprobarla. */
  targeted?: boolean;
}

const numbers = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 3 });

function labelOf(change: FixChange): string {
  return fieldByKey(change.key)?.label ?? change.label;
}

/** «Aumentar altura del loop», «Reducir …» o «Combinar ajustes del recorrido». */
export function fixTitle(option: Pick<FixOption, "changes">): string {
  if (option.changes.length > 1) return "Combinar ajustes del recorrido";

  const change = option.changes[0];

  if (!change) return "Ajustar el recorrido";
  if (change.key === "customPoints") return "Suavizar las alturas interiores";

  const action = Number(change.after) > Number(change.before) ? "Aumentar" : "Reducir";
  return `${action} ${labelOf(change).toLowerCase()}`;
}

/** «h_L: 21,5 → 24 m». */
export function changeText(change: FixChange): string {
  const name = fieldByKey(change.key)?.symbol ?? change.label;

  if (change.before === null || change.after === null) return change.label;

  const unit = change.unit ? ` ${change.unit}` : "";
  return `${name}: ${numbers.format(change.before)} → ${numbers.format(change.after)}${unit}`;
}

export function changeReason(change: FixChange): string {
  const increasing =
    Number(change.after) > Number(change.before);

  switch (change.key) {
    case "initialHeight":
      return increasing
        ? "Aporta más energía para superar subidas y mantener el contacto."
        : "Reduce la energía inicial y la rapidez, lo que puede disminuir la fuerza g y la exigencia del frenado.";

    case "initialSpeed":
      return increasing
        ? "Aporta energía cinética inicial adicional al salir de la cadena."
        : "Reduce la energía con la que el tren inicia el descenso.";

    case "trackWidth":
      return increasing
        ? "Distribuye los cambios de altura sobre más distancia y suaviza las curvas del perfil."
        : "Acorta el trazado, modifica la pendiente y reduce la distancia expuesta a la fricción.";

    case "friction":
      return increasing
        ? "Disipa más energía durante el recorrido y reduce la energía de llegada."
        : "Conserva más energía para superar subidas y alcanzar la zona final.";

    case "loopHeight":
      return increasing
        ? "Un loop más alto exige más energía pero abre la base (R_B = h_L − R) y reduce la fuerza g en B."
        : "Un loop más bajo necesita menos energía para mantener el contacto en la cima C.";

    case "loopTopRadius":
      return increasing
        ? "Un radio mayor en la cima reduce la fuerza g en C, pero exige más energía (H ≥ h_L + R/2) y cierra la base."
        : "Un radio menor en la cima abre la base del loop en lágrima (menos g en B) y pide menos altura.";

    case "hillHeight":
      return increasing
        ? "Una colina más alta llega a la cresta con menos rapidez y aumenta la fuerza g mínima."
        : "Una colina más baja se supera con menos energía.";

    case "hillCrestRadius":
      return increasing
        ? "Una cresta más abierta reduce la aceleración normal y evita la sensación de ingravidez (n_D = 1 − v²/(g·ρ_c))."
        : "Una cresta más cerrada aumenta el airtime; el motor comprobó que sigue dentro del límite.";

    case "brakingLength":
      return increasing
        ? "Da más espacio al tren para detenerse antes del final (punto F)."
        : "Ajusta el espacio de frenado; el motor comprobó que sigue siendo suficiente.";

    case "brakeDeceleration":
      return increasing
        ? "Aumenta la fuerza de los frenos y reduce la distancia de detención."
        : "Reduce la intensidad del frenado; el motor comprobó que alcanza la distancia disponible.";

    case "springConstant":
      return increasing
        ? "Un resorte más rígido necesita menos compresión para almacenar la misma energía."
        : "Un resorte menos rígido cambia la compresión y la respuesta del rebote.";

    case "springDamping":
      return "Un amortiguador viscoso disipa la energía almacenada en el resorte y evita el rebote indefinido.";

    case "maxCompression":
      return increasing
        ? "Permite mayor recorrido de compresión sin exceder el espacio de frenado."
        : "Ajusta el límite de compresión; el movimiento comprobado permanece dentro de él.";

    default:
      return (
        "Suaviza las alturas interiores y modifica las curvas " +
        "sin cambiar el inicio ni la estación."
      );
  }
}
