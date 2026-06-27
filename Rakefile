# frozen_string_literal: true
#
# Local + CI checks for the site build.
#
#   rake build   build _site/ in production mode
#   rake proof   validate internal links/anchors with html-proofer (after a build)
#   rake smoke   assert build-output invariants with minitest (after a build)
#   rake         build -> proof -> smoke (default)
#
# CI builds the site itself (with the Pages base_path) and then runs
# `rake proof smoke` against the result.

require "rake/testtask"

desc "Build the site in production mode (output in _site/)"
task :build do
  ENV["JEKYLL_ENV"] = "production"
  sh "bundle", "exec", "jekyll", "build"
end

desc "Validate internal links and anchors with html-proofer (run after a build)"
task :proof do
  # Links-only: catches broken internal links and dead #anchors (the real
  # deploy hazards). Skipped as non-hazards: external links (flaky),
  # protocol-relative CDN URLs + localhost (benign), and http-vs-https on
  # navigational links (no mixed-content risk; they redirect).
  sh "bundle", "exec", "htmlproofer", "./_site",
     "--checks", "Links",
     "--disable-external",
     "--ignore-urls", '/^\/\//,/^http:\/\/localhost/,/^#/',
     "--allow-missing-href",
     "--no-enforce-https"
end

Rake::TestTask.new(:smoke) do |t|
  t.libs << "test"
  t.test_files = FileList["test/*_test.rb"]
  t.warning = false
end
Rake::Task[:smoke].add_description "Assert build-output invariants (run after a build)"

desc "Full local check: build, then proof + smoke on the result"
task test: %i[build proof smoke]

task default: :test
