# frozen_string_literal: true

# Academic Numbering System for Jekyll
# 
# This plugin provides LaTeX-like automatic numbering and cross-referencing
# for figures, tables, equations, and algorithms in blog posts.
# 
# Usage:
#   Figures:
#     {% figure id:fig-example caption:"An example figure" %}
#       <img src="..." alt="...">
#     {% endfigure %}
#     
#     Reference: {% ref fig-example %}  -> Figure 1
#   
#   Tables:
#     {% table id:tab-example caption:"An example table" %}
#       | Header 1 | Header 2 |
#       |----------|----------|
#       | Cell 1   | Cell 2   |
#     {% endtable %}
#     
#     Reference: {% ref tab-example %}  -> Table 1
#   
#   Equations (labeled):
#     {% equation id:eq-example %}
#       E = mc^2
#     {% endequation %}
#     
#     Reference: {% ref eq-example %}  -> Eq. 1
#   
#   Algorithms:
#     {% algorithm id:alg-example caption:"My Algorithm" %}
#       ...algorithm content...
#     {% endalgorithm %}
#     
#     Reference: {% ref alg-example %}  -> Algorithm 1

module Jekyll
  # Store for numbering counters (per-page)
  module AcademicNumbering
    def self.reset_counters
      @counters = { 'figure' => 0, 'table' => 0, 'equation' => 0, 'algorithm' => 0 }
      @labels = {}
    end
    
    def self.increment(type)
      @counters ||= { 'figure' => 0, 'table' => 0, 'equation' => 0, 'algorithm' => 0 }
      @counters[type] = (@counters[type] || 0) + 1
    end
    
    def self.current(type)
      @counters ||= { 'figure' => 0, 'table' => 0, 'equation' => 0, 'algorithm' => 0 }
      @counters[type] || 0
    end
    
    def self.register_label(id, type, number)
      @labels ||= {}
      @labels[id] = { type: type, number: number }
    end
    
    def self.get_label(id)
      @labels ||= {}
      @labels[id]
    end
    
    def self.labels
      @labels ||= {}
    end
  end

  # Figure block tag: {% figure id:fig-id caption:"Caption text" %}...{% endfigure %}
  class FigureBlock < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @id = nil
      @caption = nil
      
      # Parse id:value and caption:"value"
      if markup =~ /id:\s*([^\s]+)/
        @id = $1.strip
      end
      if markup =~ /caption:\s*"([^"]+)"/
        @caption = $1.strip
      elsif markup =~ /caption:\s*'([^']+)'/
        @caption = $1.strip
      end
    end

    def render(context)
      content = super.to_s.strip
      number = AcademicNumbering.increment('figure')
      
      if @id
        AcademicNumbering.register_label(@id, 'figure', number)
      end
      
      id_attr = @id ? " id=\"#{@id}\"" : ""
      caption_html = @caption ? "<figcaption class=\"figure-caption\"><strong>Figure #{number}:</strong> #{@caption}</figcaption>" : "<figcaption class=\"figure-caption\"><strong>Figure #{number}</strong></figcaption>"
      
      <<~HTML
        <figure class="academic-figure"#{id_attr} data-figure-number="#{number}">
          <div class="figure-content">
            #{content}
          </div>
          #{caption_html}
        </figure>
      HTML
    end
  end

  # Table block tag: {% table id:tab-id caption:"Caption text" %}...{% endtable %}
  class TableBlock < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @id = nil
      @caption = nil
      
      if markup =~ /id:\s*([^\s]+)/
        @id = $1.strip
      end
      if markup =~ /caption:\s*"([^"]+)"/
        @caption = $1.strip
      elsif markup =~ /caption:\s*'([^']+)'/
        @caption = $1.strip
      end
    end

    def render(context)
      content = super.to_s.strip
      number = AcademicNumbering.increment('table')
      
      if @id
        AcademicNumbering.register_label(@id, 'table', number)
      end
      
      id_attr = @id ? " id=\"#{@id}\"" : ""
      caption_html = @caption ? "<strong>Table #{number}:</strong> #{@caption}" : "<strong>Table #{number}</strong>"
      
      <<~HTML
        <div class="academic-table"#{id_attr} data-table-number="#{number}">
          <div class="table-caption">#{caption_html}</div>
          <div class="table-content">
            #{content}
          </div>
        </div>
      HTML
    end
  end

  # Equation block tag: {% equation id:eq-id %}...{% endequation %}
  class EquationBlock < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @id = nil
      
      if markup =~ /id:\s*([^\s]+)/
        @id = $1.strip
      end
    end

    def render(context)
      content = super.to_s.strip
      number = AcademicNumbering.increment('equation')
      
      if @id
        AcademicNumbering.register_label(@id, 'equation', number)
      end
      
      id_attr = @id ? " id=\"#{@id}\"" : ""
      
      # Wrap in equation environment with number
      <<~HTML
        <div class="academic-equation"#{id_attr} data-equation-number="#{number}">
          <div class="equation-content">
            $$#{content}$$
          </div>
          <span class="equation-number">(#{number})</span>
        </div>
      HTML
    end
  end

  # Algorithm block tag: {% algorithm id:alg-id caption:"Caption" %}...{% endalgorithm %}
  class AlgorithmBlock < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @id = nil
      @caption = nil
      
      if markup =~ /id:\s*([^\s]+)/
        @id = $1.strip
      end
      if markup =~ /caption:\s*"([^"]+)"/
        @caption = $1.strip
      elsif markup =~ /caption:\s*'([^']+)'/
        @caption = $1.strip
      end
    end

    def render(context)
      content = super.to_s.strip
      number = AcademicNumbering.increment('algorithm')
      
      if @id
        AcademicNumbering.register_label(@id, 'algorithm', number)
      end
      
      id_attr = @id ? " id=\"#{@id}\"" : ""
      caption_html = @caption ? "Algorithm #{number}: #{@caption}" : "Algorithm #{number}"
      
      <<~HTML
        <div class="academic-algorithm"#{id_attr} data-algorithm-number="#{number}">
          <div class="algorithm-header">#{caption_html}</div>
          <div class="algorithm-content">
            #{content}
          </div>
        </div>
      HTML
    end
  end

  # Reference tag: {% ref fig-id %} -> "Figure 1"
  class RefTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @id = markup.strip
    end

    def render(context)
      # Output a placeholder that JavaScript will resolve
      # This handles the case where references appear before definitions
      "<a href=\"##{@id}\" class=\"ref-placeholder\" data-ref-id=\"#{@id}\">?</a>"
    end
  end

  # Equation reference tag: {% eqref eq-id %} -> "(1)"
  class EqRefTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @id = markup.strip
    end

    def render(context)
      "<a href=\"##{@id}\" class=\"eqref-placeholder\" data-ref-id=\"#{@id}\">(?)</a>"
    end
  end

  # Hook to reset counters for each page
  Jekyll::Hooks.register :pages, :pre_render do |page|
    AcademicNumbering.reset_counters
  end

  Jekyll::Hooks.register :documents, :pre_render do |doc|
    AcademicNumbering.reset_counters
  end
end

Liquid::Template.register_tag('figure', Jekyll::FigureBlock)
Liquid::Template.register_tag('table', Jekyll::TableBlock)
Liquid::Template.register_tag('equation', Jekyll::EquationBlock)
Liquid::Template.register_tag('algorithm', Jekyll::AlgorithmBlock)
Liquid::Template.register_tag('ref', Jekyll::RefTag)
Liquid::Template.register_tag('eqref', Jekyll::EqRefTag)
