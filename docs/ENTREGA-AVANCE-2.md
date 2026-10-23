# Proyecto de Simulación — Avance 2 (contenido del PDF de una página)

**Universidad CENFOTEC · Escuela de Fundamentos · Física I (FUN-18) · Sección FCV1 · 2026-C3**
**Docente:** Andrés Castro Núñez · **Fecha de entrega:** sábado 24 de octubre de 2026

## 1. Grupo y proyecto

**Grupo A** — Alejandro Soto Víquez, Dylan Josué Chaves Hernández, Minor Andrés Mora Vargas.
**Proyecto 1: Certificador de montaña rusa** (nivel estándar). Aplicación **Coaster-Certifier**.

## 2. Aplicación desplegada

https://coaster-certifier.vercel.app

## 3. Repositorio público

https://github.com/alestooo/Coaster-Certifier

## 4. Comandos

| Acción | Comando |
| --- | --- |
| Instalar dependencias | `npm install` |
| Correr las pruebas (71 pruebas, 11 de validación analítica) | `npm test` |
| Ejecución headless (escribe `output/certification.csv` y `output/certification.summary.json`) | `npm run headless` |
| Headless con otro escenario (`npm run headless -- --list` los enumera) | `npm run headless -- --scenario valley` |

Requiere Node.js ≥ 18.17. Sin motores físicos de terceros; la librería vive en `src/physics/` y su API está documentada en el `README.md`.

## 5. Estado de la implementación

**Implementado**

- Librería de física propia, pura y determinista (SI): geometría del trazado (caída, loop en lágrima parametrizado por h_L y R, colina con ρ_c, plano inclinado, trazado personalizado), fuerzas (normal, fricción μ|N|, frenos de estación, resorte con amortiguador opcional), energías y balance energético, integración RK4 (Δt ≤ 1 ms) con localización exacta de eventos.
- Criterios del dictamen del anexo: contacto N > 0 (estricto o con ruedas de seguridad), carga en [−1, +5] g, rapidez mínima en subida, compresión máxima, detención dentro de la zona de frenado; registro de cada incumplimiento con instante, tramo, posición, valor y límite; condiciones de diseño por conservación de energía.
- Pruebas: 67 en vitest, con validación analítica (plano inclinado con y sin fricción, conservación de la energía, balance con fricción, frenado MRUA, resorte, cima y base del loop, cresta de la colina, independencia de la masa, convergencia y la Tabla 5 del anexo), más pureza, determinismo, geometría, configuración, criterios y 12 escenarios de referencia.
- Script headless con CSV (25 columnas con unidad) y resumen JSON; dictamen impreso en consola.
- Aplicación desplegada: seis trazados, pasajeros, parámetros ajustables con símbolo/unidad/rango, animación con cámara, línea de tiempo y velocidad, indicador g y fuerzas; siete gráficas en tiempo real con ejes y unidades, banda de carga permitida, marcadores A–F e incumplimientos; dictamen aprobado/rechazado, recomendaciones verificadas por simulación y reporte completo exportable (CSV, JSON, PDF).

**Pendiente para la Entrega Final**

- Afinar la presentación del dictamen como documento formal (plantilla de certificado) y la exposición en clase.
- Comparación lado a lado de dos configuraciones y historial de corridas en la sesión.
- Modelo opcional de arrastre aerodinámico separado de μ (extensión del anexo) y validación adicional del tren con longitud finita.
- Revisión final de accesibilidad y pruebas de extremo a extremo de la interfaz.
