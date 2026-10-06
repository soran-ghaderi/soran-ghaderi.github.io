#!/usr/bin/env python3
"""Check publication disclosures in a served Jekyll build.

Requires: python3 -m pip install playwright && python3 -m playwright install chromium
Run: python3 scripts/check_publications.py --url http://127.0.0.1:4000/publications.html
Use --browser /usr/bin/google-chrome to use an existing Chromium installation.
"""
import argparse

from playwright.sync_api import sync_playwright


def geometry(card):
    """Measure within the card so normal browser scroll anchoring is irrelevant."""
    return card.evaluate("""card => {
      const origin = card.getBoundingClientRect();
      return [...card.querySelectorAll('.publication-card-image, .publication-card-title, .publication-authors, .publication-abstract-toggle')].map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return [r.x - origin.x, r.y - origin.y, r.width, r.height, parseFloat(s.fontSize), parseFloat(s.lineHeight)];
      });
    }""")


def same_geometry(before, after, label):
    assert len(before) == len(after), label
    assert all(abs(a - b) < 0.5 for left, right in zip(before, after)
               for a, b in zip(left, right)), (label, before, after)


def check_body(card, label):
    errors = card.evaluate("""card => {
      const body = card.querySelector('.publication-abstract-body');
      const summary = card.querySelector('summary');
      const r = body.getBoundingClientRect(), sr = summary.getBoundingClientRect();
      const s = getComputedStyle(body), errors = [];
      // Resolve the theme token without inheriting the page's color transition.
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--text-color);transition:none!important';
      document.body.append(probe);
      const themeColor = getComputedStyle(probe).color;
      probe.remove();
      if (!card.querySelector('details').open || !body.checkVisibility()) errors.push('abstract is hidden');
      if (!body.textContent.trim()) errors.push('abstract has no text');
      if (s.fontSize !== getComputedStyle(document.body).fontSize) errors.push('abstract does not use site body text size');
      if (s.color !== themeColor) errors.push('abstract text does not match current theme');
      for (const el of [body, card.querySelector('details')]) {
        const background = getComputedStyle(el).backgroundColor;
        if (background !== 'rgba(0, 0, 0, 0)' && background !== getComputedStyle(card).backgroundColor) errors.push('abstract surface differs from card');
      }
      if (Math.abs(r.x - sr.x) > 0.5 || Math.abs(r.width - sr.width) > 0.5) errors.push('abstract is not aligned to disclosure row');
      if (r.y < sr.bottom - 0.5) errors.push('abstract overlaps disclosure row');
      if (body.scrollHeight > body.clientHeight + 1) errors.push('abstract text is vertically clipped');
      for (const el of body.querySelectorAll('p, ul, ol, li, strong, em')) {
        const style = getComputedStyle(el), bounds = el.getBoundingClientRect();
        if (style.fontSize !== s.fontSize || style.lineHeight !== s.lineHeight) errors.push(el.tagName + ' has inconsistent text size or leading');
        if (['P', 'UL', 'OL', 'LI'].includes(el.tagName) && style.color !== s.color) errors.push(el.tagName + ' text does not match current theme');
        if (bounds.left < r.left - 1 || bounds.right > r.right + 1 || bounds.bottom > r.bottom + 1) errors.push(el.tagName + ' escapes abstract');
        if (el.tagName === 'STRONG' && Number(style.fontWeight) <= Number(s.fontWeight)) errors.push('bold text lost its emphasis');
      }
      if (document.documentElement.scrollWidth > innerWidth) errors.push('page overflows viewport');
      for (const el of document.querySelectorAll('.publication-card')) {
        if (el.scrollWidth > el.clientWidth + 1) errors.push('card overflows horizontally');
      }
      return errors;
    }""")
    assert not errors, (label, errors)


def set_theme(page, theme):
    # The button can be inside the collapsed navigation at mobile widths.
    page.evaluate("""theme => {
      if (document.documentElement.dataset.theme !== theme) document.querySelector('#theme-toggle').click();
    }""", theme)
    page.wait_for_timeout(350)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4000/publications.html')
    parser.add_argument('--browser', help='Chromium executable path (otherwise use Playwright Chromium)')
    args = parser.parse_args()
    cases = 0
    with sync_playwright() as playwright:
        launch_options = {'executable_path': args.browser} if args.browser else {}
        browser = playwright.chromium.launch(**launch_options)
        for motion in ['no-preference', 'reduce']:
            context = browser.new_context(reduced_motion=motion)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(args.url, wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            cards = page.locator('.publication-card:has(.publication-abstract)')
            assert cards.count(), 'No publication cards with abstracts were found'
            for width in [320, 390, 576, 768, 1024, 1440]:
                page.set_viewport_size({'width': width, 'height': 900})
                for theme in ['dark', 'light']:
                    set_theme(page, theme)
                    for index in range(cards.count()):
                        card = cards.nth(index)
                        toggle = card.locator('.publication-abstract-toggle')
                        toggle.scroll_into_view_if_needed()
                        page.wait_for_timeout(450)  # Let the initial scroll reveal finish.
                        baseline = geometry(card)
                        closed_height = card.bounding_box()['height']
                        label = f'{motion}, {width}px, {theme}, card {index + 1}'
                        toggle.click()
                        check_body(card, label)
                        same_geometry(baseline, geometry(card), label + ': open moved header')
                        assert card.bounding_box()['height'] > closed_height, label
                        toggle.press('Space')
                        assert card.locator('details').get_attribute('open') is None, label
                        same_geometry(baseline, geometry(card), label + ': close moved header')
                        assert abs(card.bounding_box()['height'] - closed_height) < 0.5, label
                        toggle.press('Enter')
                        check_body(card, label + ': keyboard reopen')
                        toggle.press('Enter')
                        cases += 1
            # Multiple disclosures stay independent and keep their typography
            # through a theme change while they are already visible.
            for toggle in page.locator('.publication-abstract-toggle').all():
                toggle.click()
            for theme in ['dark', 'light']:
                set_theme(page, theme)
                for index in range(cards.count()):
                    check_body(cards.nth(index), f'all open, {motion}, {theme}, card {index + 1}')
            assert not errors, errors
            context.close()
        browser.close()
    print(f'Passed {cases} publication cases: all cards, 6 widths, both themes and motion settings; mouse/keyboard toggles and theme changes while open.')


if __name__ == '__main__':
    main()
