# Changelog

## 1.0.3

* Now you can specify syntaxes/modes and syntax groups (`markup` or `stylesheet`) in `mark` and `preview` options to enable abbreviation marking and interactive preview in specified syntaxes only.

## v1.0.0 (15.04.2020)

Brand new implementation which uses Emmet 2 lib and highlights abbreviation as you type with real-time preview. See README for more info.

## v0.5 (29.03.2018)

* Major code refactoring and clean-up.
* Added `jsxBracket` option to force leading `<` before abbreviation to make it expandable, which makes writing JSX much more easier and predictable in JS environment with own snippets (see README).
* Support *basic* and *context-aware* abbreviation expand mode (see README).
* Support [Emmet config](https://github.com/emmetio/config) for customization.
* Improved Emmet autocomplete, added support for CSS property keyword completions.
