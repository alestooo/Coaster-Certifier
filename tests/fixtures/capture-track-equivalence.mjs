// Script de un solo uso: escribe la referencia de la equivalencia con el modelo actual.
// node tests/fixtures/capture-track-equivalence.mjs
import { writeFileSync } from "node:fs";
import { equivalenceCases, normalize } from "./track-equivalence-cases.mjs";

const reference = Object.fromEntries(equivalenceCases().map(({ name, config }) => [name, normalize(config)]));
writeFileSync(new URL("./track-equivalence.json", import.meta.url), `${JSON.stringify(reference, null, 1)}\n`);
console.log(`${Object.keys(reference).length} casos`);
