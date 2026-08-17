# ngxccc.github.io

Source code for the personal website, technical writing space, and software portfolio of **Tran Van Ngoc** ([ngxccc](https://github.com/ngxccc)).

Live site: [https://ngxccc.github.io](https://ngxccc.github.io)

---

## Architectural Principles

- **Zero Client-Side JavaScript**: Pure static HTML compilation. Fast time-to-first-byte (TTFB), lightweight resource consumption, and 100/100 Lighthouse performance.
- **Minimalist Monochrome Aesthetics**: Single cohesive global stylesheet (`global.css`) utilizing pure black and white values (`#111111` background, `#ffffff` typography, neutral `#2a2a2a` borders) inspired by classic academic and Unix engineering blogs.
- **Type-Safe Content Pipeline**: Powered by Astro Content Collections with strict Zod schema validation for post metadata (dates, tags, publication flags).
- **Automated CI/CD**: Automatic build and deployment to GitHub Pages via GitHub Actions and Bun.

---

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD to GitHub Pages
├── public/
│   ├── favicon.ico           # Multi-resolution icon (48x48, 32x32, 16x16)
│   ├── favicon.svg           # Vector favicon (32x32)
│   ├── logo.svg              # Vector logo master (512x512)
│   ├── logo.png              # High-resolution raster logo (512x512)
│   └── logo-1024.png         # Ultra-HD raster logo (1024x1024)
├── src/
│   ├── content/
│   │   └── posts/            # Technical articles and Markdown posts
│   ├── layouts/
│   │   └── BaseLayout.astro  # Universal page layout (Header, Nav, Footer)
│   ├── pages/
│   │   ├── index.astro       # Home: Overview, Selected Projects, Recent Writing
│   │   ├── about.astro       # Background, Technical Focus, Education, Contact
│   │   ├── projects.astro    # Software engineering and system projects
│   │   └── posts/
│   │       ├── index.astro   # Chronological writing archive grouped by year
│   │       └── [slug].astro  # Dynamic post detail rendering
│   ├── styles/
│   │   └── global.css        # Single minimalist stylesheet
│   └── content.config.ts     # Content collections schema definition
├── astro.config.mjs          # Astro configuration and MDX integration
├── package.json
└── tsconfig.json
```

---

## Development

This repository uses **[Bun](https://bun.sh)** as its runtime and package manager.

### Prerequisites

- Bun `>= 1.1.0` (or Node.js `>= 22.12.0`)

### Commands

```bash
# 1. Install dependencies
bun install

# 2. Start local development server (http://localhost:4321)
bun run dev

# 3. Compile static production build to ./dist/
bun run build

# 4. Preview the static production build locally
bun run preview
```

---

## Deployment

The website is continuously deployed to GitHub Pages via `.github/workflows/deploy.yml` upon every push to the `main` branch.

To configure GitHub Pages on a fork or mirror:

1. Navigate to **Repository Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.

---

## License

- **Written Content & Articles**: Licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC-BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- **Source Code & Templates**: Licensed under the [MIT License](LICENSE).
