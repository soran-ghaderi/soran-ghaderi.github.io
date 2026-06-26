# Jekyll 4 + GitHub Actions migration

**Date:** 2026-06-26
**Goal:** Move off the frozen `github-pages 198` stack (Jekyll 3.8.5, 2019-era gems) to modern
Jekyll 4 on Ruby 3.3, and switch deployment from the legacy GitHub Pages builder to GitHub
Actions — without changing how the site renders.

## Why

- Local dev was impossible: the pinned 2019 native gems (nokogiri 1.10.8, eventmachine 1.2.7)
  won't build on Ubuntu 26.04 / gcc-15.
- Production is built by the **legacy** Pages builder (`build_type: legacy`), which ignores the
  repo's `Gemfile` and runs Jekyll 3.x in safe mode. Consequence: the custom plugin
  `_plugins/academic_numbering.rb` (`{% figure %}`, `{% ref %}`, …) is silently disabled in
  production, and the Gemfile has no effect on the live site.

## Key enabling fact

The theme is **fully vendored** (`_layouts/`, `_includes/`, `_sass/`, `assets/`). The site's
appearance does not depend on the `github-pages` / `modern-resume-theme` gem at build time, so
swapping the gem stack cannot restyle the site. The only build engine that matters is Jekyll +
the listed plugins.

## Design

### 1. Gem stack (Ruby 3.3, zero compilation)
- `Gemfile`: drop `gemspec` (this is what pulled in `github-pages ~> 198`). Add `jekyll ~> 4.4`,
  `webrick` (Ruby 3 no longer bundles it), `kramdown-parser-gfm` (kramdown 2.x ships GFM
  separately). Keep the **same** `:jekyll_plugins` group so build behavior is unchanged.
- Regenerate `Gemfile.lock` on Ruby 3.3; modern nokogiri ships precompiled binaries → no gcc.
- Lock must include the `x86_64-linux` platform so the Actions runner installs identical gems.

### 2. Deployment → GitHub Actions
- Add `.github/workflows/deploy.yml` (official Jekyll-on-Pages template): `setup-ruby 3.3` +
  `bundler-cache` → `jekyll build` (`JEKYLL_ENV=production`) → `upload-pages-artifact` →
  `deploy-pages`.
- Update `.github/workflows/ci.yml` PR check from Ruby 2.6 → 3.3; html-proofer via `bundle exec`.
- Flip Pages `build_type` `legacy` → `workflow`. **Outward-facing; done last, after local
  verification, with explicit go-ahead.**

### 3. Verification before the switch
- Build + serve locally on Jekyll 4; eyeball homepage, a blog post, a project post.
- Diff new `_site` against the live production pages (authoritative old output) for Sass/kramdown
  drift. Watch items: Dart Sass `@import` deprecation *warnings* (non-fatal); `aspect-ratio: 16/9`
  (visually identical even if evaluated); kramdown 1.x → 2.x **math** rendering in the 3 posts
  that use it.
- Smoke-test the custom plugin with a throwaway `{% figure %}`.

### 4. Cleanup (sequenced after verification)
- `rbenv uninstall -f 2.7.8` (the old fallback Ruby).
- Optional: remove `gcc-13`/`g++-13`, and the orphaned theme-gem scaffolding
  (`modern-resume-theme.gemspec`, `lib/modern-resume-theme/`, `modern-resume-theme-master.zip`,
  stale `.travis.yml`).

## Rollback
Flip Pages back to `legacy` (instant); Ruby 2.7.8 + gcc-13 remain available until explicitly
removed. A failed Actions build does **not** take down the site — Pages keeps serving the last
successful deploy.

## Risk assessment (post-scout)
Low. No `site.github.*` metadata usage (only the `github_username` config key), no deprecated
`gems:` key, pagination inert. Highest-attention item: kramdown 2.x math output — verified at
build, not assumed.
