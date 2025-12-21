---
title: "Rendering LaTeX Equations on Websites"
description: "A comprehensive guide to displaying mathematical equations on websites using various LaTeX rendering libraries"
date: 2024-12-19
tags: ["latex", "web-development", "math", "katex", "mathjax"]
---

# Rendering LaTeX Equations on Websites

This guide covers the main approaches to rendering beautiful mathematical equations on websites.

## Overview of Options

| Library | Pros | Cons | Best For |
|---------|------|------|----------|
| **KaTeX** | Very fast, small bundle | Fewer LaTeX features | Static sites, performance-critical apps |
| **MathJax** | Full LaTeX support, accessible | Slower, larger bundle | Academic sites, complex math |
| **Temml** | Lightweight, MathML output | Newer, less adoption | Modern browsers, accessibility |

---

## Option 1: KaTeX (Recommended for Most Cases)

KaTeX is the fastest math rendering library. It's what this site uses!

### Basic Setup (CDN)

Add these to your HTML `<head>`:

```html
<!-- KaTeX CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">

<!-- KaTeX JS -->
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>

<!-- Auto-render extension (renders all math on page) -->
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body);"></script>
```

### Configure Auto-Render

Customize which delimiters trigger math rendering:

```html
<script>
document.addEventListener("DOMContentLoaded", function() {
    renderMathInElement(document.body, {
        delimiters: [
            {left: '$$', right: '$$', display: true},   // Block math
            {left: '$', right: '$', display: false},    // Inline math
            {left: '\\(', right: '\\)', display: false}, // Alternative inline
            {left: '\\[', right: '\\]', display: true}   // Alternative block
        ],
        throwOnError: false
    });
});
</script>
```

### Writing Math with KaTeX

**Inline math** (flows with text): `$E = mc^2$` renders as $E = mc^2$

**Block/display math** (centered on its own line):
```
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

Renders as:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### NPM Installation (for Build Tools)

```bash
npm install katex
```

```javascript
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Render to a DOM element
katex.render("c = \\pm\\sqrt{a^2 + b^2}", element, {
    throwOnError: false
});

// Or get HTML string
const html = katex.renderToString("E = mc^2");
```

---

## Option 2: MathJax (Most Complete)

MathJax supports the widest range of LaTeX commands and produces the best accessibility output.

### Basic Setup (CDN)

```html
<script>
MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
    },
    svg: {
        fontCache: 'global'
    }
};
</script>
<script id="MathJax-script" async 
    src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js">
</script>
```

### Output Formats

MathJax can output in different formats:

- **SVG** (`tex-svg.js`): Sharp at any zoom, best for most cases
- **CHTML** (`tex-chtml.js`): Uses HTML/CSS, good for copying text
- **MathML** (`tex-mml-chtml.js`): Best for accessibility

### Advanced Configuration

```html
<script>
MathJax = {
    tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
        packages: ['base', 'ams', 'physics'], // LaTeX packages
        macros: {
            RR: '\\mathbb{R}',  // Custom macros
            bold: ['\\mathbf{#1}', 1]
        }
    },
    options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'code']
    }
};
</script>
```

---

## Option 3: Markdown Processors with Math

If you're using a static site generator or markdown-based system:

### Remark/Rehype (Astro, Next.js, etc.)

```bash
npm install remark-math rehype-katex
```

```javascript
// astro.config.mjs
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default {
    markdown: {
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex]
    }
};
```

Don't forget to include the KaTeX CSS in your layout!

### Markdown-it

```bash
npm install markdown-it-katex
```

```javascript
const md = require('markdown-it')();
const mk = require('markdown-it-katex');
md.use(mk);

const result = md.render('Euler: $e^{i\\pi} + 1 = 0$');
```

---

## Common LaTeX Examples

### Fractions and Roots

```latex
$\frac{a}{b}$           <!-- Simple fraction -->
$\dfrac{a}{b}$          <!-- Display-style fraction -->
$\sqrt{x}$              <!-- Square root -->
$\sqrt[3]{x}$           <!-- Cube root -->
```

$\frac{a}{b}$, $\dfrac{a}{b}$, $\sqrt{x}$, $\sqrt[3]{x}$

### Greek Letters

```latex
$\alpha, \beta, \gamma, \delta, \epsilon$
$\Gamma, \Delta, \Theta, \Lambda, \Omega$
```

$\alpha, \beta, \gamma, \delta, \epsilon$

$\Gamma, \Delta, \Theta, \Lambda, \Omega$

### Subscripts and Superscripts

```latex
$x^2$           <!-- Superscript -->
$x_i$           <!-- Subscript -->
$x_i^2$         <!-- Both -->
$x_{i,j}^{2n}$  <!-- Grouped -->
```

$x^2$, $x_i$, $x_i^2$, $x_{i,j}^{2n}$

### Sums and Integrals

```latex
$$\sum_{i=1}^{n} x_i$$

$$\int_0^\infty e^{-x} dx$$

$$\oint_C \vec{F} \cdot d\vec{r}$$
```

$$\sum_{i=1}^{n} x_i$$

$$\int_0^\infty e^{-x} dx$$

### Matrices

```latex
$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

$$
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
$$
```

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

### Aligned Equations

```latex
$$
\begin{aligned}
(x + y)^2 &= x^2 + 2xy + y^2 \\
(x - y)^2 &= x^2 - 2xy + y^2
\end{aligned}
$$
```

$$
\begin{aligned}
(x + y)^2 &= x^2 + 2xy + y^2 \\
(x - y)^2 &= x^2 - 2xy + y^2
\end{aligned}
$$

### Cases (Piecewise Functions)

```latex
$$
f(x) = \begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
$$
```

$$
f(x) = \begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
$$

---

## Troubleshooting

### Math Not Rendering

1. **Check script loading order**: Ensure KaTeX/MathJax loads before your content
2. **Check delimiters**: Make sure you're using the configured delimiters
3. **Escape backslashes**: In JavaScript strings, use `\\` for `\`
4. **Check console**: Look for JavaScript errors

### Dollar Signs in Text

If you need literal `$` signs in text:
- Use `\$` to escape
- Or configure different delimiters

### Performance Tips

1. **KaTeX over MathJax** for better performance
2. **Server-side rendering** when possible (pre-render at build time)
3. **Lazy loading** for pages with lots of math
4. **Self-host** KaTeX files instead of CDN for faster loads

---

## Quick Reference: Choosing a Library

```
Need speed/small bundle?     → KaTeX
Need obscure LaTeX commands? → MathJax  
Using Markdown processor?    → remark-math + rehype-katex
Need accessibility (MathML)? → MathJax or Temml
```

## Resources

- [KaTeX Documentation](https://katex.org/docs/supported.html)
- [MathJax Documentation](https://docs.mathjax.org/)
- [LaTeX Math Symbols](https://oeis.org/wiki/List_of_LaTeX_mathematical_symbols)
- [Detexify](https://detexify.kirelabs.org/) - Draw a symbol to find its LaTeX command
