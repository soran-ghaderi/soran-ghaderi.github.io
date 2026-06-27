# frozen_string_literal: true
#
# Smoke tests: assert deploy-critical invariants of the built _site.
# Run AFTER a production build (the :build / :test rake tasks handle this).

require "minitest/autorun"

class SiteSmokeTest < Minitest::Test
  SITE = File.expand_path("../_site", __dir__)
  PROD = "https://soran-ghaderi.github.io"

  def rel(abs)       = abs.sub("#{SITE}/", "")
  def site_path(p)   = File.join(SITE, p)
  def contents(p)    = File.read(site_path(p))
  def html_files     = Dir.glob(site_path("**/*.html"))

  def assert_present(p)
    assert File.file?(site_path(p)), "missing expected output: #{p}"
    assert File.size(site_path(p)).positive?, "empty output: #{p}"
  end

  def test_site_dir_exists
    assert Dir.exist?(SITE), "_site/ not found — run `rake build` first"
  end

  def test_key_outputs_exist
    %w[
      index.html publications.html projects-page.html blog.html
      blog/video-world-models/index.html projects/torchebm/index.html
      feed.xml sitemap.xml robots.txt assets/main.css
    ].each { |p| assert_present(p) }
  end

  def test_math_is_rendered
    assert_includes contents("blog/video-world-models/index.html"), 'type="math/tex"',
                    "MathJax math/tex tags missing — kramdown math may have broken"
  end

  def test_no_liquid_errors
    offenders = html_files.select { |f| File.read(f) =~ /Liquid (Exception|error)/i }
    assert_empty offenders.map { |f| rel(f) }, "Liquid render errors found in output"
  end

  def test_no_unrendered_liquid_tags
    offenders = html_files.select { |f| File.read(f).include?("{%") }
    assert_empty offenders.map { |f| rel(f) }, "unrendered Liquid tags ({%) found in output"
  end

  def test_excluded_paths_not_published
    refute Dir.exist?(site_path("lib")),     "_site/lib/ should be excluded"
    refute Dir.exist?(site_path("scripts")), "_site/scripts/ should be excluded"
    refute File.exist?(site_path("modern-resume-theme-master.zip")),
           "the theme zip should not be published"
  end

  def test_production_urls
    sitemap = contents("sitemap.xml")
    assert_includes sitemap, PROD, "sitemap.xml is missing the production domain"
    refute_includes sitemap, "localhost", "sitemap.xml contains localhost URLs (built in dev mode?)"
    assert_includes contents("feed.xml"), PROD, "feed.xml is missing the production domain"
  end

  def test_seo_meta_present
    home = contents("index.html")
    assert_includes home, '<meta name="generator"', "missing <meta name=generator>"
    assert_match %r{<link rel="canonical" href="#{Regexp.escape(PROD)}/?"}, home,
                 "canonical link is not on the production domain"
  end
end
