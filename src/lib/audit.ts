/**
 * Capa de auditoría en lenguaje claro.
 *
 * Traduce el dictamen de la librería de física (incumplimientos con
 * códigos, resumen numérico) a mensajes para el panel de diseño: qué
 * falla, dónde, por cuánto y qué grupo de parámetros lo controla.
 * No contiene ecuaciones de movimiento: solo lee el dictamen.
 */
import type { SimulationConfig, Verdict } from "./types";
import { formatNumber } from "../ui/format";

export type Tone = "ok" | "warn" | "bad" | "info";

/** Grupos del panel de diseño, en el orden en que el tren los recorre. */
export type AreaId = "start" | "layout" | "loop" | "hill" | "braking" | "criteria" | "numeric";

export interface PlainIssue {
  code: string;
  area: AreaId;
  title: string;
  detail: string;
  section: string;
  time: number;
  x: number;
  y: number;
}

export interface LimitGauge {
  value: number;
  limit: number;
  section: string;
  tone: Tone;
}

/** «returned»: entró a la zona, el resorte lo devolvió y quedó quieto antes de E. */
export type BrakingOutcome = "stopped" | "overrun" | "not-reached" | "no-stop" | "returned";

export interface BrakingInsight {
  outcome: BrakingOutcome;
  entrySpeed: number | null;
  stoppingDistance: number | null;
  /** Distancia v_E²/(2·(a_f + μ·g)) que necesitan los frenos (solo frenos en la recta). */
  requiredDistance: number | null;
  available: number;
  tone: Tone;
  text: string;
}

export interface AreaInsight {
  tone: Tone;
  text: string;
}

export interface AuditReport {
  approved: boolean;
  title: string;
  headline: string;
  issues: PlainIssue[];
  maxG: LimitGauge;
  minG: LimitGauge;
  maxSpeed: { value: number; section: string };
  braking: BrakingInsight;
  areas: Partial<Record<AreaId, AreaInsight>>;
}

type Violation = Verdict["violations"][number];
type SectionSummary = Verdict["summary"]["sections"][number];

/** Fracción del límite de fuerza g a partir de la cual se advierte (90 %). */
export const NEAR_LIMIT_FRACTION = 0.9;

/** Margen sobre el límite inferior de fuerza g que dispara una advertencia (g). */
export const LOW_G_MARGIN = 0.2;

/** Fracción de la zona de frenado usada a partir de la cual se advierte. */
const BRAKE_USAGE_WARNING = 0.85;

/** Incumplimientos que siempre corresponden al sistema de frenado. */
/** Incumplimientos del frenado: se atribuyen a la zona de frenado aunque ocurran en otro tramo. */
const BRAKING_CODES = new Set(["overrun", "compression", "outside-braking"]);
/** Los que significan que el tren se pasa de la zona (no el rebote que lo devuelve). */
const OVERRUN_CODES = new Set(["overrun", "compression"]);

/** Grupo del panel que controla el tramo donde ocurrió algo. */
export function areaForSection(section: string, code?: string): AreaId {
  if (code && BRAKING_CODES.has(code)) return "braking";
  if (/loop/i.test(section)) return "loop";
  if (/colina/i.test(section)) return "hill";
  if (/frenado|resorte/i.test(section)) return "braking";
  if (/caída inicial|plano inclinado/i.test(section)) return "start";
  return "layout";
}

/** Número legible: enteros sin decimales, el resto con `digits`. */
function num(value: number, digits = 1): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : digits);
}

function issueText(violation: Violation, config: SimulationConfig): { title: string; detail: string } {
  const where = violation.section;
  const value = violation.value;
  const limit = violation.limit;

  switch (violation.code) {
    case "max-load":
      return {
        title: "Fuerza g demasiado alta",
        detail: `En ${where} los pasajeros sentirían ${formatNumber(value, 2)} g; el máximo permitido es ${num(limit)} g.`
      };
    case "min-load":
      return {
        title: "Fuerza g demasiado baja",
        detail: `En ${where} la fuerza g baja a ${formatNumber(value, 2)} g; el mínimo permitido es ${num(limit)} g.`
      };
    case "contact":
      return {
        title: "El tren se despega de la vía",
        detail: `En ${where} la vía deja de sostener al tren (N = ${formatNumber(value, 0)} N). La regla «siempre apoyado» exige N > 0.`
      };
    case "loop-contact":
      return {
        title: "El tren se despega dentro del loop",
        detail: `En ${where} la fuerza normal llega a ${formatNumber(value, 0)} N: le falta rapidez en la cima (se necesita v² ≥ g·R).`
      };
    case "compression":
      return {
        title: "El resorte se comprime de más",
        detail: `El resorte se comprime ${formatNumber(value, 2)} m y lo permitido es ${num(limit, 2)} m.`
      };
    case "overrun":
      return {
        title: "No se detiene a tiempo",
        detail: "El tren llega al final de la zona de frenado (punto F) todavía en movimiento."
      };
    case "reverse":
      return {
        title: "El tren regresa al inicio",
        detail: "Le faltó energía para avanzar y retrocedió hasta el punto A."
      };
    case "min-speed":
      return {
        title: "El tren se queda sin impulso",
        // El evento se registra justo al cruzar el umbral: el valor exacto no aporta, la causa sí.
        detail: `En ${where} la rapidez baja de ${num(limit)} m/s mientras sube: le falta energía para terminar la subida.`
      };
    case "incomplete":
      return {
        title: "No completa el recorrido",
        detail: `Se detuvo en ${where}, antes de llegar a la zona de frenado.`
      };
    case "outside-braking":
      return {
        title: "Queda fuera de la zona de frenado",
        detail: `Entró a la zona, pero el rebote en el resorte lo devolvió y se detuvo en ${where}, antes de E.`
      };
    case "timeout":
    case "unfinished": {
      const bouncing = config.brakeMode === "spring" && config.springDamping === 0;
      return {
        title: "No se detiene en el tiempo observado",
        detail: bouncing
          ? `Tras ${num(violation.time, 0)} s sigue en movimiento: un resorte sin amortiguador devuelve la energía y el tren rebota sin fin.`
          : `Tras ${num(violation.time, 0)} s el tren sigue en movimiento.`
      };
    }
    default:
      return { title: violation.condition, detail: `En ${where}.` };
  }
}

/** Un resorte que no detiene al tren lo devuelve fuera de la zona: el problema sigue siendo el frenado. */
const SPRING_STOP_CODES = new Set(["timeout", "unfinished"]);

/** Verdadero si el incumplimiento ocurrió después de entrar a la zona de frenado (el tren volvió). */
function happenedAfterBraking(violation: Violation, verdict: Verdict): boolean {
  const braking = verdict.summary.braking;

  return (
    "entryTime" in braking &&
    braking.reached &&
    !BRAKING_CODES.has(violation.code) &&
    violation.time > braking.entryTime
  );
}

function reboundText(text: { title: string; detail: string }, config: SimulationConfig) {
  const damperHint = config.springDamping === 0 ? " Un amortiguador (c > 0) disiparía esa energía." : "";

  return {
    title: "El tren rebota y vuelve hacia atrás",
    detail: `Tras rebotar en el resorte, el tren regresa por la vía. ${text.detail}${damperHint}`
  };
}

function describeIssue(violation: Violation, config: SimulationConfig, verdict: Verdict): PlainIssue {
  const springFailure = config.brakeMode === "spring" && SPRING_STOP_CODES.has(violation.code);
  const rebound = config.brakeMode === "spring" && happenedAfterBraking(violation, verdict);
  const text = issueText(violation, config);

  return {
    code: violation.code,
    area: springFailure || rebound ? "braking" : areaForSection(violation.section, violation.code),
    ...(rebound ? reboundText(text, config) : text),
    section: violation.section,
    time: violation.time,
    x: violation.x,
    y: violation.y
  };
}

function maxGauge(verdict: Verdict, config: SimulationConfig): LimitGauge {
  const { value, section } = verdict.summary.maxLoad;
  const limit = config.maxLoad;
  const tone: Tone = value > limit ? "bad" : value >= NEAR_LIMIT_FRACTION * limit ? "warn" : "ok";

  return { value, limit, section, tone };
}

function minGauge(verdict: Verdict, config: SimulationConfig): LimitGauge {
  const { value, section } = verdict.summary.minLoad;
  const limit = config.contactModel === "strict" ? 0 : config.minLoad;
  const tone: Tone = value <= limit ? "bad" : value < limit + LOW_G_MARGIN ? "warn" : "ok";

  return { value, limit, section, tone };
}

function brakingInsight(verdict: Verdict, config: SimulationConfig): BrakingInsight {
  const braking = verdict.summary.braking;
  const available = config.brakingLength;
  const isSpring = config.brakeMode === "spring";

  if (!("entrySpeed" in braking) || !braking.reached) {
    return {
      outcome: "not-reached",
      entrySpeed: null,
      stoppingDistance: null,
      requiredDistance: null,
      available,
      tone: "info",
      text: "El tren no llega a la zona de frenado."
    };
  }

  const entrySpeed = braking.entrySpeed;
  // En la recta actúan los frenos y la fricción: MRUA con a = a_f + μ·g.
  const deceleration = config.brakeDeceleration + config.friction * config.gravity;
  const requiredDistance = isSpring ? null : entrySpeed ** 2 / (2 * deceleration);
  const entry = `Entra a ${formatNumber(entrySpeed, 1)} m/s`;

  if (braking.stopped && braking.stoppingDistance !== null) {
    const usage = braking.stoppingDistance / available;

    return {
      outcome: "stopped",
      entrySpeed,
      stoppingDistance: braking.stoppingDistance,
      requiredDistance,
      available,
      tone: usage > BRAKE_USAGE_WARNING ? "warn" : "ok",
      text: `${entry} y se detiene en ${formatNumber(braking.stoppingDistance, 1)} m de ${num(available, 0)} m.`
    };
  }

  if (verdict.violations.some(violation => violation.code === "outside-braking")) {
    return {
      outcome: "returned",
      entrySpeed,
      stoppingDistance: null,
      requiredDistance,
      available,
      tone: "bad",
      text: `${entry}, el resorte lo devuelve y queda quieto antes de E.`
    };
  }

  const overrun = verdict.violations.some(violation => OVERRUN_CODES.has(violation.code));

  if (overrun) {
    return {
      outcome: "overrun",
      entrySpeed,
      stoppingDistance: null,
      requiredDistance,
      available,
      tone: "bad",
      text:
        requiredDistance === null
          ? `${entry} y el resorte no alcanza a detenerlo dentro de lo permitido.`
          : `${entry}: necesita ${formatNumber(requiredDistance, 0)} m para detenerse y solo hay ${num(available, 0)} m.`
    };
  }

  return {
    outcome: "no-stop",
    entrySpeed,
    stoppingDistance: null,
    requiredDistance,
    available,
    tone: "bad",
    text: isSpring
      ? `${entry} y rebota: el resorte devuelve la energía sin detenerlo.`
      : `${entry} y no termina de detenerse.`
  };
}

function sectionsOf(verdict: Verdict, area: AreaId): SectionSummary[] {
  return verdict.summary.sections.filter(section => areaForSection(section.name) === area);
}

function frictionShare(verdict: Verdict): number {
  const initial = verdict.summary.initialEnergy;
  if (!(initial > 0)) return 0;

  const lost = verdict.summary.sections
    .filter(section => areaForSection(section.name) !== "braking")
    .reduce((sum, section) => sum + (section.dissipated ?? 0), 0);

  return Math.max(0, lost / initial);
}

function loopInsight(verdict: Verdict, config: SimulationConfig): AreaInsight | undefined {
  const loops = verdict.summary.sections.filter(section => section.kind === "loop");
  if (!loops.length) return undefined;

  const reached = loops.filter(section => section.reached);
  if (!reached.length) return { tone: "info", text: "El tren no llega al loop." };

  const maxLoad = Math.max(...reached.map(section => section.maxLoad ?? 0));
  const minLoad = Math.min(...reached.map(section => section.minLoad ?? 0));
  const tone: Tone =
    maxLoad >= NEAR_LIMIT_FRACTION * config.maxLoad || minLoad < LOW_G_MARGIN ? "warn" : "ok";

  return { tone, text: `Hasta ${formatNumber(maxLoad, 2)} g en la base · ${formatNumber(minLoad, 2)} g en la cima` };
}

function hillInsight(verdict: Verdict, config: SimulationConfig): AreaInsight | undefined {
  const hill = sectionsOf(verdict, "hill");
  if (!hill.length) return undefined;

  const reached = hill.filter(section => section.reached);
  if (!reached.length) return { tone: "info", text: "El tren no llega a la colina." };

  const minLoad = Math.min(...reached.map(section => section.minLoad ?? 1));
  const limit = config.contactModel === "strict" ? 0 : config.minLoad;
  const tone: Tone = minLoad < limit + LOW_G_MARGIN ? "warn" : "ok";

  return { tone, text: `Mínimo ${formatNumber(minLoad, 2)} g sobre la cresta` };
}

function criteriaText(config: SimulationConfig): string {
  return config.contactModel === "strict"
    ? `Hasta ${num(config.maxLoad)} g · siempre apoyado (N > 0)`
    : `De ${num(config.minLoad)} g a ${num(config.maxLoad)} g · con ruedas anti-levantamiento`;
}

function buildAreas(
  verdict: Verdict,
  config: SimulationConfig,
  issues: PlainIssue[],
  braking: BrakingInsight
): Partial<Record<AreaId, AreaInsight>> {
  const head = config.initialHeight + config.initialSpeed ** 2 / (2 * config.gravity);
  const maxSpeed = verdict.summary.maxSpeed.value;

  const areas: Partial<Record<AreaId, AreaInsight>> = {
    // μ se edita en la salida: su lectura suma cuánto disipa la fricción antes de frenar.
    start: {
      tone: "ok",
      text:
        `Puede subir hasta ${formatNumber(head, 1)} m · rapidez máx. ${formatNumber(maxSpeed, 1)} m/s` +
        (config.friction > 0 ? ` · la fricción disipa ${formatNumber(100 * frictionShare(verdict), 0)} % antes de frenar` : "")
    },
    loop: loopInsight(verdict, config),
    hill: hillInsight(verdict, config),
    braking: { tone: braking.tone, text: braking.text },
    criteria: { tone: "info", text: criteriaText(config) }
  };

  // Un incumplimiento manda sobre cualquier otra lectura del grupo.
  for (const issue of issues) {
    const current = areas[issue.area];
    areas[issue.area] = { tone: "bad", text: current && issue.area === "braking" ? current.text : issue.title };
  }

  return areas;
}

/** Construye la auditoría legible a partir del dictamen de la librería. */
export function buildAudit(verdict: Verdict, config: SimulationConfig): AuditReport {
  const issues = verdict.violations.map(violation => describeIssue(violation, config, verdict));
  const braking = brakingInsight(verdict, config);
  const maxG = maxGauge(verdict, config);

  // El titular no repite lo que ya dicen las tarjetas (frenado) ni el primer problema (su tarjeta).
  const first = verdict.violations[0];
  const count = issues.length;
  const headline = verdict.approved
    ? `Completa el recorrido sin superar ${num(config.maxLoad)} g.`
    : count
      ? `${count} ${count === 1 ? "incumplimiento" : "incumplimientos"}${first ? ` · el primero en ${first.section}` : ""}`
      : "Se detectó al menos un incumplimiento.";

  return {
    approved: verdict.approved,
    title: verdict.approved ? "Aprobado" : `Rechazado: ${issues[0]?.title.toLowerCase() ?? "revisá el diseño"}`,
    headline,
    issues,
    maxG,
    minG: minGauge(verdict, config),
    maxSpeed: { value: verdict.summary.maxSpeed.value, section: verdict.summary.maxSpeed.section },
    braking,
    areas: buildAreas(verdict, config, issues, braking)
  };
}
