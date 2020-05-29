# Changelog

## 1.1.0 (29.05.2020)

* Emmet updated to v2.1.0: improved fuzzy search mechanism for CSS abbreviations. It provides much better feedback, especially when user types full CSS property name.
* Improved context detection for abbreviations in HTML and CSS: inline CSS is properly supported in both `<style>` and `style="..."`. It also detects if current caret position is inside or outside CSS selector and skips property abbreviations in latter case.
* New extension method `editor.getEmmetCompletion(pos)`: returns completion for CodeMirror’s [show-hint](https://codemirror.net/doc/manual.html#addon_show-hint) module if it’s available for given `pos`.

## 1.0.3 (18.05.2020)

* Now you can specify syntaxes/modes and syntax groups (`markup` or `stylesheet`) in `mark` and `preview` options to enable abbreviation marking and interactive preview in specified syntaxes only.

## v1.0.0 (15.04.2020)

Brand new implementation which uses Emmet 2 lib and highlights abbreviation as you type with real-time preview. See README for more info.

## v0.5 (29.03.2018)

* Major code refactoring and clean-up.
* Added `jsxBracket` option to force leading `<` before abbreviation to make it expandable, which makes writing JSX much more easier and predictable in JS environment with own snippets (see README).
* Support *basic* and *context-aware* abbreviation expand mode (see README).
* Support [Emmet config](https://github.com/emmetio/config) for customization.
* Improved Emmet autocomplete, added support for CSS property keyword completions.
