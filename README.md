# Linear Algebra Suite

React + Vite application to study and visualize linear and affine maps in $\mathbb{R}^2$.

The user interface and generated reports are currently in Spanish by design.
This README is intentionally maintained in English.

## Features

- Interactive exploration of linear and affine transformations in 2D.
- Canonical form analysis and step-by-step report generation.
- KaTeX-based mathematical rendering.
- Two export paths:
	- Server-side deterministic PDF generation (local Node/Express backend).
	- Static HTML report output (GitHub Pages-compatible fallback).

## Tech Stack

- Frontend: React 19 + Vite + TypeScript.
- Backend (local/prod if self-hosted): Node.js + Express.
- Math rendering: KaTeX.

## Local Development

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run dev
```

This runs:

- The Vite dev server for the UI.
- The Express backend used by `/api/*` export endpoints.

## Build and Local Preview

Build + serve with Express:

```bash
npm run preview
```

Equivalent command:

```bash
npm start
```

Both commands build `dist/` and serve it through Express, including `/api/*` endpoints.

## NPM Scripts

- `npm run dev`: Run frontend + backend in parallel.
- `npm run dev:client`: Run Vite only.
- `npm run dev:server`: Run Express server only.
- `npm run build`: Type-check and build production assets.
- `npm run preview`: Build, then start Express.
- `npm start`: Same as `npm run preview`.
- `npm run lint`: Run ESLint.

## Deployment Notes

### GitHub Pages (Static Hosting)

The repository includes a GitHub Actions flow that builds `dist/` and publishes to GitHub Pages on pushes to `main`.

Because GitHub Pages does not run Node.js, server-side PDF generation is not available there.
In that environment, export opens a standalone HTML report page that can be printed or saved as PDF in the browser.

During CI builds, the public base path is automatically derived from the repository name.

### External API for PDF Export (Optional)

If you want server-side PDF generation in production, deploy the Node backend separately and set:

- `VITE_PDF_API_BASE_URL`: Base URL for the external PDF API.

## License

This project is licensed under GNU General Public License v3.0 or later (`GPL-3.0-or-later`).

Copyright (C) 2026 Pablo Portilla.

Distributed without any warranty. See `LICENSE` for details.
