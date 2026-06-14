# Reconstruction Plan

## First Principles
1. Formatting = CSS on HTML. Solved problem.
2. Paste → pick style → preview → copy. Four steps.
3. Copy-to-clipboard = export mechanism.

## Delete (14 files)
- script.js (833 lines legacy monolith)
- style.css.bak (dead backup)
- PRD.md (986 lines of future-ware)
- REFACTOR-PLAN.md (old plan)
- src/ (13 files: app.js, editor.js, export.js, html-mode.js, image.js, preview.js, theme.js, toast.js, utils.js, version.js, view-integration.js, wechat-view.js, config/security.js)
- css/ (6 files: variables.css, layout.css, components.css, preview.css, responsive.css, wechat-view.css)
- test/ (5 files: setup + 4 test files)
- vite.config.js (unnecessary complexity)

## Create (3 files)
- index.html — minimal structure: textarea + theme bar + copy button
- style.css — layout + 5 theme definitions
- app.js — marked parse → DOMPurify sanitize → inline styles → copy

## Keep
- package.json (marked + dompurify deps)
- README.md (updated)
- .gitignore
- .github/

## Result
~250 lines replacing ~3800+ lines. Three files. Zero backend.
