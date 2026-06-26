# frozen_string_literal: true
source "https://rubygems.org"

# Jekyll 4.x — built locally and on GitHub Pages via GitHub Actions.
# The theme is vendored under _layouts/_includes/_sass/assets, so no theme gem
# is required; we intentionally no longer depend on the `github-pages` gem.
gem "jekyll", "~> 4.4"

# Ruby 3.x no longer bundles webrick; `jekyll serve` needs it.
gem "webrick", "~> 1.9"

# kramdown 2.x ships its GFM parser as a separate gem; Jekyll's default
# markdown input is GFM, so this must be present.
gem "kramdown-parser-gfm", "~> 1.1"

group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-sitemap"
  gem "jekyll-paginate"
  gem "jekyll-seo-tag"
  gem "jekyll-archives"
  gem "jekyll-redirect-from"
  gem "kramdown"
  gem "rouge"
end

# HTML validation in CI (bundle exec htmlproofer).
group :development, :test do
  gem "html-proofer", "~> 5.0"
end

# Windows-only helpers — no-ops on Linux/macOS and the CI runner.
gem "tzinfo-data", platforms: [:mingw, :mswin, :x64_mingw, :jruby]
gem "wdm", "~> 0.1.1", platforms: [:mingw, :mswin, :x64_mingw]
