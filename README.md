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

## Despliegue en GitHub Pages

El repositorio incluye un flujo en GitHub Actions que construye `dist/` y publica automaticamente el sitio en GitHub Pages al hacer push a `main`.

En GitHub Pages no existe backend Node, asi que la exportacion usa una vista imprimible del navegador. Desde ahi se puede guardar el informe como PDF.

Si quieres usar un backend externo para conservar la generacion de PDFs en produccion, define la variable `VITE_PDF_API_BASE_URL` durante el build apuntando al origen del API.
# linear_algebra
