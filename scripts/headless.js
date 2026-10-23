#!/usr/bin/env node
/**
 * Ejecución headless del motor de física.
 *
 * Corre un escenario fijo sin interfaz gráfica, escribe un CSV con la
 * evolución temporal de las magnitudes principales y un JSON con el
 * dictamen, e imprime un resumen en consola.
 *
 *   npm run headless                       → escenario "certification"
 *   npm run headless -- --scenario valley  → otro escenario de referencia
 *   npm run headless -- --config mi.json   → configuración propia (JSON)
 *   npm run headless -- --list             → lista los escenarios
 *   npm run headless -- --dt 0.005 --out salida
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import {
  runSimulation,
  toCsv,
  SCENARIOS,
  findScenario,
  ConfigError
} from "../src/physics/index.js";

/**
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
function parseArguments(argv) {
  /** @type {Record<string, string | boolean>} */
  const options = {};

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    if (!argument.startsWith("--")) continue;

    const key = argument.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }

  return options;
}

/** @param {number | null | undefined} value @param {number} [digits] */
function fmt(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

/**
 * @param {import("../src/physics/run.js").SimulationRun} run
 * @param {string} title
 */
function printReport(run, title) {
  const { verdict, final, config } = run;
  const { summary } = verdict;

  console.log(`\n=== Coaster-Certifier · ${title} ===`);
  console.log(`Recorrido: ${config.mapId} · masa ${config.mass} kg · μ ${config.friction} · frenado: ${config.brakeMode}`);
  console.log(`Estado final: ${final.status} · t = ${fmt(final.time, 3)} s · s = ${fmt(final.distance)} m`);
  console.log(`\nDICTAMEN: ${verdict.approved ? "APROBADO ✔" : "RECHAZADO ✘"}`);

  for (const reason of verdict.reasons) {
    console.log(`  · ${reason}`);
  }

  console.log("\nPuntos críticos:");
  console.log("  Punto  s (m)     t (s)     v (m/s)   n (g)     N (N)");

  for (const point of summary.criticalPoints) {
    const row = point.reached
      ? `${fmt(point.distance).padStart(8)}  ${fmt(point.time, 3).padStart(8)}  ${fmt(point.speed).padStart(8)}  ${fmt(point.load).padStart(8)}  ${fmt(point.normal, 0).padStart(8)}`
      : `${fmt(point.distance).padStart(8)}  (no alcanzado)`;

    console.log(`  ${point.label.padEnd(5)}  ${row}  ${point.name}`);
  }

  console.log("\nExtremos:");
  console.log(`  Rapidez máxima     ${fmt(summary.maxSpeed.value)} m/s en ${summary.maxSpeed.section} (t = ${fmt(summary.maxSpeed.time)} s)`);
  console.log(`  Carga máxima       ${fmt(summary.maxLoad.value)} g en ${summary.maxLoad.section}`);
  console.log(`  Carga mínima       ${fmt(summary.minLoad.value)} g en ${summary.minLoad.section}`);
  console.log(`  Normal mínima      ${fmt(summary.minNormal.value, 1)} N en ${summary.minNormal.section}`);
  console.log(`  Energía disipada   ${fmt(summary.dissipatedEnergy, 1)} J de ${fmt(summary.initialEnergy, 1)} J iniciales`);
  console.log(`  Error de balance   ${summary.maxBalanceError.value.toExponential(2)} J (máximo absoluto)`);

  if (summary.braking.reached) {
    console.log(`  Frenado            v_E = ${fmt(summary.braking.entrySpeed)} m/s · d_det = ${fmt(summary.braking.stoppingDistance ?? Number.NaN)} m · impulso ${fmt(summary.braking.impulse, 0)} N·s`);
  }

  console.log("\nCondiciones de diseño (energía sin fricción):");

  for (const check of verdict.designChecks) {
    console.log(`  ${check.ok ? "✔" : check.severity === "error" ? "✘" : "⚠"} ${check.name} · ${check.formula} · ${check.detail}`);
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.list) {
    console.log("Escenarios disponibles:");
    for (const scenario of SCENARIOS) {
      console.log(`  ${scenario.id.padEnd(16)} ${scenario.title}`);
    }
    return;
  }

  const outDir = resolve(String(options.out ?? "output"));
  const timeStep = options.dt ? Number(options.dt) : undefined;

  let config;
  let name;

  if (typeof options.config === "string") {
    config = JSON.parse(readFileSync(resolve(options.config), "utf8"));
    name = options.config.replace(/\.json$/i, "").split(/[\\/]/).pop() ?? "custom";
  } else {
    const id = String(options.scenario ?? "certification");
    const scenario = findScenario(id);

    if (!scenario) {
      console.error(`Escenario desconocido: ${id}. Usá --list para verlos.`);
      process.exitCode = 1;
      return;
    }

    config = scenario.config;
    name = scenario.id;
  }

  const started = performance.now();
  const run = runSimulation(config, { timeStep });
  const elapsed = performance.now() - started;

  mkdirSync(outDir, { recursive: true });

  const csvPath = join(outDir, `${name}.csv`);
  const jsonPath = join(outDir, `${name}.summary.json`);

  writeFileSync(csvPath, toCsv(run.history));
  writeFileSync(
    jsonPath,
    JSON.stringify({ config: run.config, verdict: run.verdict, track: { sections: run.track.sections, markers: run.track.markers } }, null, 2)
  );

  printReport(run, name);
  console.log(`\n${run.history.length} estados simulados en ${elapsed.toFixed(0)} ms.`);
  console.log(`CSV:     ${csvPath}`);
  console.log(`Resumen: ${jsonPath}`);

  if (!run.verdict.approved) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`Configuración inválida (${error.field}): ${error.message}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
}

process.on("exit", code => {
  // Garantiza el código de salida aunque la salida estándar siga vaciándose.
  if (code === 0 && process.exitCode) process.exit(process.exitCode);
});
