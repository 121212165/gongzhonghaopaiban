# First-Principles Reconstruction: gongzhonghaopaiban

> Applied Elon Musk's first-principles thinking: break to fundamental truths, rebuild from zero.

## Core Problem

WeChat public account writers need to format articles with consistent styling.

## First Principles Breakdown

1. Formatting = applying CSS to HTML. This is a solved problem.
2. Paste content, pick a style, get styled output. Three steps.
3. Copy-to-clipboard is the export mechanism.

## Essential Features

| Priority | Feature |
|----------|---------|
| P0 | Rich text editor input |
| P0 | Style template selection |
| P0 | Real-time preview |
| P0 | Copy styled HTML to clipboard |

## Reconstruction Blueprint

Single-page app: textarea input -> template engine -> preview -> copy button. Vanilla JS + CSS. Zero backend.

## Musk\'s Razor

Cut any framework. Cut any backend. This is a client-side CSS transformer with a copy button.
