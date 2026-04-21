# Linear Algebra Suite

Aplicacion React + Vite para explorar aplicaciones lineales y afines en R2.

## Desarrollo local

```bash
npm install
npm run dev
```

El entorno local levanta:

- Vite para la interfaz.
- Express para la generacion determinista de PDFs.

## Vista previa y arranque local del build

```bash
npm run preview
```

o bien

```bash
npm start
```

Ambos comandos construyen `dist/` y sirven el resultado con Express, incluyendo los endpoints `/api/*` para la generacion de PDFs LaTeX.

## Despliegue en GitHub Pages

El repositorio incluye un flujo en GitHub Actions que construye `dist/` y publica automaticamente el sitio en GitHub Pages al hacer push a `main`.

En GitHub Pages no existe backend Node, asi que la exportacion abre una pagina HTML independiente con formulas matematicas y estilo de informe. Desde ahi se puede imprimir o guardar el resultado como PDF. Durante el build en GitHub Actions, la base publica se ajusta automaticamente al nombre del repositorio.

Si quieres usar un backend externo para conservar la generacion de PDFs en produccion, define la variable `VITE_PDF_API_BASE_URL` durante el build apuntando al origen del API.

## Licencia

Este proyecto se distribuye bajo la GNU General Public License v3.0 o posterior (`GPL-3.0-or-later`).

Copyright (C) 2026 Pablo Portilla.

Se distribuye sin ninguna garantia. Consulta `LICENSE` para el texto completo.
