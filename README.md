# Linear Algebra Algorithms in R2

This project is an interactive implementation of several elementary algorithms from my linear algebra class. The goal is not to replace the theory, but to make the computations visible: you choose vectors or points in the plane, the app reconstructs the corresponding map, classifies it, shows the canonical form, and generates a detailed step-by-step report.

The user interface and generated reports are written in Spanish, because the project follows the notation and language of the course. This README is written in English for easier technical maintenance.

## What the App Does

The app studies two related problems in $\mathbb R^2$.

### Linear maps

In the linear tab, the user chooses a basis $(b_1,b_2)$ and its images $T(b_1),T(b_2)$. From that data the app reconstructs the matrix of the linear map in the standard basis.

The algorithm is:

1. Build the basis matrix
   $$
   B=[b_1\ b_2]
   $$
   and the image matrix
   $$
   Y=[T(b_1)\ T(b_2)].
   $$
2. Check that $B$ is invertible by computing $\det(B)$.
3. Recover the linear map:
   $$
   A=YB^{-1}.
   $$
4. Compute $\operatorname{tr}(A)$, $\det(A)$, and the discriminant of the characteristic polynomial.
5. Classify the real canonical form:
   - two distinct real eigenvalues,
   - a scalar matrix,
   - a Jordan block,
   - or a real block associated with a complex conjugate pair.
6. Build an adapted basis and verify the reduction with
   $$
   P^{-1}AP=J.
   $$

### Affine maps

In the affine tab, the user chooses three source points $p_0,p_1,p_2$ and three image points $q_0,q_1,q_2$. If the source triangle is not degenerate, these data determine a unique affine map

$$
F(x)=Ax+b.
$$

The algorithm is:

1. Check affine independence by computing the oriented double area of the triangle $(p_0,p_1,p_2)$.
2. Pass from points to direction vectors:
   $$
   S=[p_1-p_0\ p_2-p_0],
   \qquad
   T=[q_1-q_0\ q_2-q_0].
   $$
3. Recover the linear part:
   $$
   A=TS^{-1}.
   $$
4. Recover the translation using $F(p_0)=q_0$:
   $$
   b=q_0-Ap_0.
   $$
5. Study fixed points by solving
   $$
   (I-A)x=b.
   $$
6. Choose an adapted affine reference and verify the normal form with homogeneous matrices:
   $$
   C^{-1}H_FC=H_{\mathrm{can}}.
   $$

The affine classification distinguishes cases with a unique fixed point, a line of fixed points, all points fixed, pure translations, and residual translations that cannot be removed by changing the origin.

## How to Use the App

Install dependencies:

```bash
npm install
```

Start the local development version:

```bash
npm run dev
```

This starts two processes:

- Vite frontend: `http://localhost:5173/`
- Express backend: `http://localhost:4174/`

Then open the Vite URL in your browser.

In the app:

1. Choose either the `Lineal` or `Afin` tab.
2. Drag points/vectors in the coordinate plane, or edit their coordinates in the side panel.
3. Read the live classification and canonical form.
4. Use `Restablecer ejemplo` to return to the default example.
5. Use the report button to generate a detailed explanation of the computation.

## Reports and Exports

The project has two report paths.

### Local PDF export

When the Express backend is available, the report button asks the backend to build a LaTeX document and compile it into a PDF.

Endpoints:

- `POST /api/linear-pdf`
- `POST /api/affine-pdf`
- `GET /api/health`

The backend compiles with `pdflatex`, so a local LaTeX installation is required for true PDF generation. If `pdflatex` is not installed, the app can still run, but server-side PDF generation will fail.

### Static HTML report export

When the backend is not available, the app opens a standalone printable report page instead. This is the mode used by static deployments such as GitHub Pages.

The static report:

- renders mathematics with KaTeX,
- stores the report data temporarily in `localStorage`,
- can be printed or saved as PDF from the browser,
- includes a `.tex` download when enough valid data are available.

## Local Version vs Global Version

In this repository, "local version" means running the app on your machine with Node.js. "Global version" means the deployed static web version, for example on GitHub Pages.

### Local version

Run with:

```bash
npm run dev
```

or build and serve through Express:

```bash
npm start
```

The local version can use the Express API. If `pdflatex` is installed, it can generate deterministic PDF files directly from LaTeX.

Use the local version when:

- you are developing the app,
- you want server-side PDF generation,
- you need to test API endpoints,
- you want the closest version to a self-hosted deployment.

### Global static version

Build with:

```bash
npm run build
```

The output is written to `dist/` and can be hosted as static files. Static hosting cannot run the Express server, so the PDF API is not available there. The app therefore falls back to the printable HTML report flow.

Use the global version when:

- you want a public webpage that does not require a backend,
- you are deploying to GitHub Pages or another static host,
- browser print-to-PDF is enough,
- downloading the generated `.tex` source is acceptable.

If the app is deployed under a subpath, set:

```bash
VITE_BASE_PATH=/your-subpath/
```

During builds, the Vite base path is also derived from `GITHUB_REPOSITORY` when available.

## Optional External PDF API

It is possible to host the frontend statically but send PDF requests to a separate backend. Set:

```bash
VITE_PDF_API_BASE_URL=https://your-api.example.com
```

When this variable is present, the frontend calls that server for `/api/linear-pdf` and `/api/affine-pdf` instead of relying on same-origin API routes.

## Project Structure

```text
src/
  App.tsx                         Main interactive UI
  components/
    CartesianPlane.tsx            SVG coordinate plane and draggable objects
    PrintableReportPage.tsx       Printable report page
  lib/
    math2d.ts                     Core 2D linear and affine algorithms
    symbolicMath.ts               Rational and radical formatting helpers
    reportContent.ts              Browser-rendered report content
    reportTex.ts                  LaTeX report generation
    reportExport.ts               Report storage and export flow
server.mjs                        Express API and server-side PDF compilation
vite.config.ts                    Vite configuration and base path handling
```

## NPM Scripts

```bash
npm run dev
```

Runs frontend and backend together.

```bash
npm run dev:client
```

Runs only the Vite frontend.

```bash
npm run dev:server
```

Runs only the Express backend.

```bash
npm run build
```

Type-checks and builds the production static assets.

```bash
npm run preview
```

Builds the app and serves `dist/` through Express.

```bash
npm start
```

Same practical use as `npm run preview`: build, then serve with Express.

```bash
npm run lint
```

Runs ESLint.

## Requirements

- Node.js and npm.
- A modern browser.
- Optional: a LaTeX distribution with `pdflatex` for local server-side PDF generation.

## Notes for the Class

The app intentionally keeps the computations elementary. Most formulas shown in the reports are the same formulas one would write by hand:

- matrix reconstruction from images of a basis,
- determinant tests for independence,
- characteristic polynomial and discriminant,
- eigenvectors and generalized eigenvectors,
- fixed point equation for affine maps,
- homogeneous coordinates for affine conjugation.

That makes the project useful as a companion to the class: students can modify examples, see how each number changes, and compare the final canonical form with the intermediate calculations.

## License

This project is licensed under the GNU General Public License v3.0 (`GPL-3.0-only`).

Copyright (C) 2026 Pablo Portilla.

Distributed without any warranty. See `LICENSE` for details.
