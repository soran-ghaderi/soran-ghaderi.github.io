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

# Color palette (see _config.yml comments for hex values + ready-made "recipe" combos)
palette:
  dark_bg: "near-black"    # near-black | pure-black | charcoal | slate | midnight | ink | espresso
  light_bg: "white"        # white | snow | cream | cool-gray | ivory | sand | bone | linen
                           # | almond | parchment | oat | blush | dove | sage-mist | mist
  accent: "crimson"        # reds: vivid-red | crimson | coral | rose | ruby
                           # editorial: clay | terracotta | rust | brick | burgundy | ochre | bronze
                           #            | olive | sage | moss | pine | teal | denim | indigo | steel | plum
  navbar: "darker"         # dark | darker | pure-black | slate | ink
# Mid-century editorial recipe: light_bg: sand + dark_bg: ink + navbar: ink + a warm
# accent (clay/ochre) or cool-organic accent (teal/sage/indigo/plum).

# Typography (see _config.yml comments for full guide). Pick a preset, then
# optionally override any single field with a Google Fonts family / weight / size.
typography:
  preset: "modern"         # system | modern | editorial | grotesk | book
  body_font: ""            # any Google Fonts family (blank = preset)
  heading_font: ""         # family for h1-h6 (blank = same as body)
  code_font: ""            # monospace family (blank = preset)
  body_weight: ""          # 100-900 (blank = preset)
  heading_weight: ""       # 100-900 (blank = preset)
  base_size: ""            # e.g. "1.6rem" (blank = preset)
  scale: ""                # modular-scale ratio, e.g. 1.25 (blank = preset)
  line_height: ""          # body density, e.g. 1.45 (blank = preset)

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
| `awards.yml` | Awards and funding (CV page) |
| `menu_items/menu.yml` | Navigation bar entries |
| `skills.yml` | Technical skills |

### Publications

```yaml
# _data/publication.yml
- layout: left-publication
  title: "Paper Title"
  venue: "Conference/Journal"
  year: 2024
  publication_type: "Conference Paper"
  selected: true          # feature on the homepage (Selected Publications)
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
  selected: true          # feature on the homepage (Selected Software)
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
publication_title: Publications
selected_publications_title: Selected Publications   # homepage
selected_projects_title: Selected Software           # homepage
awards_title: Awards                                 # CV page
skills_title: Technical Skills
```

The homepage shows the About section plus entries flagged `selected: true`.

### About backdrop

The homepage shows a rounded photo panel of the Radcliffe Camera behind the portrait, filling the profile column from the top of the about row to the end of the about text (a fixed-height card on phones). `scripts/make_backdrop.py` generates the assets (crop, sky extension, grade, 1x/2x WebP + JPEG fallback, inline placeholder) into `assets/images/backdrop/` and writes `_data/about_backdrop.yml` (`enabled`, `side: left|right`, srcset, caption, credit). The photo is CC BY-SA 4.0, so the homepage footer prints the credit line from that file. The image is skipped in print and when the visitor prefers reduced data.

### Portrait

`about_profile_image` in `_config.yml` is the full-resolution source photo only. `scripts/make_portrait.py` crops it head-and-shoulders, white-balances it part way, quietens the background, applies the same grade as the backdrop and writes 1x/2x/3x WebP (plus a JPEG fallback), the favicon set, the Apple touch icon and the 1200px social-card image into `assets/images/portrait/`, recording the paths in `_data/about_portrait.yml`. `_includes/about.html`, `menubar.html` (brand logo) and `head.html` (icons) read that file; `image`, `logo` and `favicon` in `_config.yml` point at the generated files too. Re-run the script after replacing the photo and adjust `CROP` in it if the framing changes. `--hq DIR` also writes a full-quality `portrait-hq.jpg` (no grain, quality 92) for profile uploads such as LinkedIn; it is not part of the site.
Education, experience, the full publication list, awards and all projects live on the CV page (`_pages/cv.html`, served at `/cv.html`).

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
