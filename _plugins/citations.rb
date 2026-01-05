# frozen_string_literal: true

# LaTeX-like Citation System for Jekyll
# 
# This plugin provides BibTeX-style citations for blog posts.
# 
# Usage:
#   {% cite einstein1905 %}           -> Inline citation [1]
#   {% cite key1, key2 %}             -> Multiple citations [1, 2]
#   
#   {% bibliography %}
#   @article{einstein1905,
#     author = {Albert Einstein},
#     title = {On the Electrodynamics of Moving Bodies},
#     ...
#   }
#   {% endbibliography %}

module Jekyll
  # Tag for inline citations: {% cite key %} or {% cite key1, key2 %}
  class CiteTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @keys = markup.strip.split(/\s*,\s*/).map(&:strip).reject(&:empty?)
    end

    def render(context)
      # Output a placeholder that the JavaScript will process
      # We use a custom syntax that won't be escaped
      keys_str = @keys.join(', ')
      "<span class=\"cite-placeholder\" data-cite-keys=\"#{keys_str}\"></span>"
    end
  end

  # Block tag for bibliography: {% bibliography %} ... {% endbibliography %}
  class BibliographyBlock < Liquid::Block
    def render(context)
      content = super.to_s
      # Wrap in a script tag to prevent Jekyll from processing the BibTeX content
      # The JavaScript will extract and parse this
      <<~HTML
        <script type="text/bibliography" style="display:none;">
        #{content}
        </script>
      HTML
    end
  end
end

Liquid::Template.register_tag('cite', Jekyll::CiteTag)
Liquid::Template.register_tag('bibliography', Jekyll::BibliographyBlock)
