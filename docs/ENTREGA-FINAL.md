# Proyecto de Simulación — Entrega Final (contenido del PDF de una página)

**Universidad CENFOTEC · Escuela de Fundamentos · Física I (FUN-18) · Sección FCV1 · 2026-C3**
**Docente:** Andrés Castro Núñez · **Fecha de entrega:** jueves 3 de diciembre de 2026 (semana 14)

## 1. Grupo y proyecto

**Grupo A** — Alejandro Soto Víquez, Dylan Josué Chaves Hernández, Minor Andrés Mora Vargas.
**Proyecto 1: Certificador de montaña rusa.** Aplicación **Coaster-Certifier**.

## 2. Aplicación desplegada

https://coaster-certifier.vercel.app — funciona desde cualquier navegador, sin instalación (también en el teléfono).

## 3. Repositorio público

https://github.com/alestooo/Coaster-Certifier

## 4. Comandos

| Acción | Comando |
| --- | --- |
| Instalar dependencias | `npm install` |
| Pruebas automáticas (librería, validación analítica, equivalencia e interfaz) | `npm test` |
| Ejecución headless (escribe `output/certification.csv` y `output/certification.summary.json`) | `npm run headless` |
| Headless con otro escenario (`npm run headless -- --list` los enumera) | `npm run headless -- --scenario valley` |
| Pruebas de extremo a extremo sobre el build (Chrome) | `npm run e2e` |
| Servidor de desarrollo | `npm run dev` |

Requiere Node.js ≥ 18.17. Sin motores físicos de terceros: la librería vive en `src/physics/`, es pura y determinista (SI), y su API está documentada en el `README.md`.

## 5. Qué entrega

- **Librería de física propia:**
  - trazado por elementos en metros (puntos con loop en lágrima, colinas con ρ_c exacto, lanzadores LSM, frenos de ajuste, subida por cadena);
  - partícula o tren articulado de N carros con el peor carro en los criterios;
  - fricción de Coulomb, aire cuadrático, frenos de estación y resorte con amortiguador;
  - RK4 con subpaso de 1 ms y localización de eventos por bisección;
  - balance E_m + E_dis = E₀ + W_entrada.
- **Validación:**
  - pruebas analíticas (plano inclinado, energía, frenado con y sin aire, velocidad terminal, lanzador en dos fases, frenos de ajuste lineales en v, resorte, loop, cresta, Tabla 5 del anexo);
  - una prueba de equivalencia con el modelo anterior;
  - los 12 escenarios de referencia.
- **Taller web:**
  - edición libre sobre la pista (cualquier trazado, en 2D, con deshacer);
  - auditoría en vivo con dictamen, franja de fuerza g sobre la vía y correcciones verificadas por simulación;
  - siete gráficas en tiempo real con ejes y unidades;
  - estimador de capacidad, energía y estructura;
  - optimizador con objetivo y valores elegibles (rangos de la Tabla 2), resultado verificado como pista fantasma y qué limita la mejora;
  - informe de certificación imprimible y descargas CSV y JSON.
- **Documentación:** el `README.md` cubre el modelo, los supuestos, el dominio de validez, el método numérico (RK4, subpaso, eventos, corrección del reposo con fricción de Coulomb), las pruebas y la API; la arquitectura está en `docs/ARQUITECTURA.md`.
