# Academic Portfolio Template

A Jekyll-based academic portfolio and blog for researchers. Features publications with citations, project showcases, technical blog posts with LaTeX support, and a configurable dark/light theme.

**Example:** [soran-ghaderi.github.io](https://soran-ghaderi.github.io)

## Features

- **Academic Publications** — CSL-JSON citations, venue/year/author metadata, paper/code/website links
- **Project Showcase** — GitHub badges, descriptions, and categorization
- **Technical Blog** — MathJax/KaTeX support, syntax highlighting, featured posts
- **Custom Citation System** — GitHub Pages–compatible BibTeX citations with APA/IEEE/Chicago/Vancouver styles
- **Academic Numbering** — Auto-numbered figures, tables, equations, and algorithms with cross-references
- **Theming** — Configurable dark/light mode with customizable color palettes
- **SEO** — Built-in `jekyll-seo-tag` support

---

## Quick Start

### 1. Fork or Clone

```bash
git clone https://github.com/soran-ghaderi/soran-ghaderi.github.io.git my-portfolio
cd my-portfolio
```

### 2. Run Locally

**With Docker (recommended):**
```bash
docker-compose up
```

**With Ruby/Jekyll:**
```bash
bundle install
bundle exec jekyll serve --livereload
```

Site available at `http://localhost:4000`

### 3. Deploy

Push to a GitHub repository named `<username>.github.io` for automatic GitHub Pages deployment.

---

## Configuration

### `_config.yml`

Core settings:

```yaml
name: Your Name
title: Your Title
email: your@email.com
darkmode: true  # true | false | never

# Color palette
palette:
  dark_bg: "near-black"    # near-black | pure-black | charcoal | slate | midnight
  light_bg: "white"        # white | snow | cream | cool-gray
  accent: "crimson"        # vivid-red | crimson | coral | rose | ruby
  navbar: "darker"         # dark | darker | pure-black | slate

# Citation style for blog posts
citation_style: "apa"      # apa | ieee | chicago | vancouver

# Social links
github_username: your-username
twitter_username: your-handle
linkedin_username: your-profile
orcid_username: 0000-0000-0000-0000
```

---

## Content Structure

All content is driven by YAML files in `_data/`:

| File | Purpose |
|------|---------|
| `publication.yml` | Research papers with citations |
| `projects.yml` | Open-source projects |
| `experience.yml` | Work history |
| `education.yml` | Academic background |
| `skills.yml` | Technical skills |

### Publications

```yaml
# _data/publication.yml
- layout: left-publication
  title: "Paper Title"
  venue: "Conference/Journal"
  year: 2024
  publication_type: "Conference Paper"
  authors:
    - Your Name
    - Co-Author Name
  paper: https://doi.org/...
  code: https://github.com/...
  website: https://project-page.com
  image: /images/paper-figure.png
```

### Projects

```yaml
# _data/projects.yml
- layout: left
  name: Project Name
  github: username/repo
  link: github.com/username/repo
  description: >
    <b>Short description.</b><br>
    <span style="color:#888">Python · PyTorch</span><br>
    <img alt="Stars" src="https://img.shields.io/github/stars/username/repo?style=social">
```

---

## Blog Posts

Create posts in `_posts/` with filename `YYYY-MM-DD-slug.md`:

```markdown
---
layout: post
title: "Post Title"
author: Your Name
image: https://example.com/featured.png
featured: true
---

Inline math: $E = mc^2$

Block math:
$$p(x) = \frac{e^{-E(x)}}{Z}$$
```

### Citations

Use the built-in citation system (no plugins required):

```markdown
As shown in prior work <cite data-key="smith2024"></cite>, the method...

<!-- At end of post -->
<div class="bibliography-data" style="display:none;">
@article{smith2024,
  author = {Smith, John},
  title = {Paper Title},
  year = {2024},
  url = {https://...}
}
</div>
```

Multiple citations: `<cite data-key="key1, key2, key3"></cite>` → `[1, 2, 3]`

### Academic Numbering

Figures, tables, equations, and algorithms are auto-numbered:

```markdown
<figure class="academic-figure" id="fig-arch">
  <img src="/images/architecture.png" alt="Architecture">
  <figcaption data-caption="Model architecture overview"></figcaption>
</figure>

As shown in <a href="#fig-arch" class="ref"></a>...

<div class="academic-equation" id="eq-loss">

$$\mathcal{L} = \mathbb{E}[\|x - \hat{x}\|^2]$$

</div>

Using <a href="#eq-loss" class="eqref"></a>...  <!-- renders as "(1)" -->
```

---

## Directory Structure

```
├── _config.yml          # Site configuration
├── _data/               # YAML content files
│   ├── publication.yml
│   ├── projects.yml
│   ├── experience.yml
│   ├── education.yml
│   └── skills.yml
├── _posts/              # Blog posts
├── _layouts/            # Page templates
├── _includes/           # Reusable components
├── _sass/               # SCSS stylesheets
├── assets/
│   ├── js/
│   │   ├── citations.js         # Citation system
│   │   └── academic-numbering.js
│   └── main.scss
└── images/              # Static images
```

---

## Customization

### Styling

Edit `assets/main.scss` or add partials in `_sass/`:

```scss
// assets/main.scss
@import 'modern-resume-theme';

// Your custom styles
.custom-class {
  color: var(--accent-color);
}
```

### Section Titles

Override in `_config.yml`:

```yaml
education_title: Education
publication_title: Selected Publications
skills_title: Technical Skills
```

---

## Development

### Local Build

```bash
bundle exec jekyll build
```

Output in `_site/`.

### Adding Pages

Create in `_pages/`:

```yaml
---
layout: page
title: New Page
permalink: /new-page/
---
```

---

## License

MIT License. See [LICENSE](LICENSE).

---

## Credits

Originally forked from [modern-resume-theme](https://github.com/sproogen/modern-resume-theme) by James Grant.
