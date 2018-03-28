# Emmet 2 extension for CodeMirror editor

[CodeMirror](http://codemirror.net/) extension that adds [Emmet](https://emmet.io) support to text editor.

---

**Extension development is sponsored by [CodePen](https://codepen.io).**

---

## How to use

This extension can be installed as a regular npm module:

```
npm install --save @emmetio/codemirror-plugin
```

The package itself follows CodeMirror extension convention and simply registers new commands and some extension methods. In order to use Emmet, you should create CodeMirror instance and provide keymap with Emmet actions. Currently, this extension registers only 2 actions:

* `emmetExpandAbbreviation` – expand abbreviation from current cursor position.
* `emmetWrapWithAbbreviation` – wraps selected content with abbreviation.
* `emmetInsertLineBreak` – inserts formatted line break if cursor is between tags.

The package comes in to flavors: a stand-alone browser bundle and ES2015/CommonJS modules that you can use in your app.

If you’re building an app, you can use extension like this:

```js
import CodeMirror from 'codemirror';
import emmet from '@emmetio/codemirror-plugin';

// Register extension on CodeMirror constructor
emmet(CodeMirror);

// Create editor instance and provide keymap for Emmet actions
const editor = CodeMirror.fromTextArea(document.getElementById('code'), {
	mode : "text/html",
	extraKeys: {
		'Tab': 'emmetExpandAbbreviation',
		'Enter': 'emmetInsertLineBreak'
	}
});
```

For a stand-alone, basic usage, simply add `dist/emmet-codemirror-plugin.js` file into your page:

```html
<script src="codemirror.js"></script>
<script src="./dist/emmet-codemirror-plugin.js"></script>

<form>
	<textarea id="code" name="code"></textarea>
</form>

<script>
var editor = CodeMirror.fromTextArea(document.getElementById("code"), {
	mode : "text/html",
	extraKeys: {
		'Tab': 'emmetExpandAbbreviation',
		'Enter': 'emmetInsertLineBreak'
	}
});
</script>
```

## Context-aware abbreviation expand

This plugin offers two modes of expanding abbreviation: *basic* (`emmetExpandAbbreviationAll` action) and *context-aware* (`emmetExpandAbbreviation` acton). Consider following example (`|` is a caret position):

```html
<div title|="test">
```

If you try to expand abbreviation in basic mode from given position, the `title` attribute will be replaced with `<title></title>`: it simply extracts & expands abbreviation left to current caret position, no matter if such behavior is expected.

The *context-aware* mode analyzes current caret location and detects if it’s expected to expand abbreviation here. In the example above, context-aware mode simply ignores `title` abbreviation.

Context-aware mode in limited syntaxes only, such as HTML, CSS, Slim, Pug, and it used by default in autocomplete provider. You can use basic mode as a fallback in case you’re working in document with unsupported syntax.

Another feature of context-aware mode is CSS value abbreviations: it can detect that caret is inside CSS property value and resolves abbreviation against know CSS property keywords (defined in [CSS snippets](http://github.com/emmetio/snippets/)). For example, if you try to expand abbreviation here:

```css
transform: tr|;
```

...it will insert `translate(x, y)` instead of `text-replace: ;` since it will match `tr` with known keywords of `translate` property, defined in Emmet snippets.

## Autocomplete provider

The new Emmet 2 concept suggests that Emmet should be used as autocomplete provider: it gives user full control over Tab key, editors’ native snippets and provides real-time preview of expanded abbreviation.

CodeMirror doesn’t have native autocomplete support but provides fully optional [show-hint](http://codemirror.net/doc/manual.html#addon_show-hint) module. To add autocomplete support into your CodeMirror instance, call `.getEmmetCompletions()` extension method in editor instance and use its result as a provider for autocomplete extension. This method returns object with the following properties:

* `from` and `to` properties describe range of matched Emmet abbreviation in editor.
* `list` contains list of completions with the following properties:
	* `type`: type of completion item, either `expanded-abbreviation` or `snippet`.
	* `range`: object with `from` and `to` properties that describe range of editor content to be replaced with current completion item. Note that for `expanded-abbreviation` item type this range matches full abbreviation, while for `snippet` type it matches only a part of abbreviation.
	* `name`: completion display label.
	* `preview`: preview of expanded completion item.
	* `snippet`: expanded completion item, may contain fields like `${1}`.
	* `insert()`: a method that applies current completion item to editor.

For a complete example of how to use Emmet completions with `show-hint` module, see `example.html` file.

## JSX bracket

If you pass `jsxBracket: true` option, the context-aware abbreviation expander will require a leading `<` before abbreviation to make it expandable. It is especially helpful if you’re using JS snippets or use Tab to align code fragments. 

Here are some examples of how <kbd>Tab</kbd> key behavior differs with `jsxBracket` disabled and enabled:

```js
// jsxBracket: false (default)
var div| = 'elem1';  // var <div></div> = 'elem';
return span|;        // return <span><em></em></span>

// jsxBracket: true
var div| = 'elem1';  // var div     = 'elem';
return <span|;       // return <span></span>
```

## Tag pair marking and renaming

Pass `markTagPairs: true` option to enable automatic HTML tag pair marking in editor: open and close tags will be marked with `.emmet-open-tag` and `.emmet-close-tag` classes respectively. If this option enabled (off by default), changing either open or close tag will automatically update the opposite part. To disable automatic renaming, pass `autoRenameTags: false` option:

```js
const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
	mode : "text/html",
	// Enable tag marking (off by default).
	markTagPairs: true,

	// Enable tag auto-rename (enabled by default).
	// Requires `markTagPairs` to be enabled
	autoRenameTags: true
});
```

## Wrap With Abbreviation

The [Wrap With Abbreviation]()https://docs.emmet.io/actions/wrap-with-abbreviation/ action requires user prompt to enter abbreviation. By default, the `window.prompt()` method is used. But you can use your own prompt UI by registering `emmetPrompt` option:

```js
editor.setOption('emmetPrompt', function(editor, message, callback) {
	// Run `callback(abbr)` after user have entered abbreviation or run `callback(null)` to cancel
});
```

## Adding custom snippets

You can add custom Emmet snippets via `emmet` option when creating CodeMirror editor instance:

```js
const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
	mode : "text/html",
	extraKeys: {
		'Tab': 'emmetExpandAbbreviation',
		'Enter': 'emmetInsertLineBreak'
	},

	// Example of passing custom snippets to Emmet.
	// See https://github.com/emmetio/config
	emmet: {
		globals: {
			markup: {
				snippets: {
					foo: 'div.foo[bar=baz]'
				}
			},
			stylesheet: {
				snippets: {
					myp: 'my-super: property'
				}
			}
		}
	}
});
```

Note that markup and stylesheet snippet definitions are different. Markup snippets are written as Emmet abbreviations (e.g. you simply describe element name and its default attributes) while stylesheet snippets are aliases to CSS properties with optional keywords list, separated by `|` character. These keywords are used in abbreviation resolving process. For more examples, see [@emmetio/snippets](http://github.com/emmetio/snippets) repo.

## How it works

In order to provide a predictable completions list, this extension automatically marks Emmet abbreviation as a [text marker](https://codemirror.net/doc/manual.html#api_marker) when user types text in editor. This marker is automatically re-validated on change and destroyed when user edits different part of code. The marker has `.emmet-abbreviation` class and can be styled via CSS to give users a clue what part of text will be expanded as abbreviation. Also, this marker contains `.model` property with extracted and parsed abbreviation.

The main reason to use text marker is to allow user to edit entered abbreviation and maintain proper autocomplete and abbreviation expansion context. You can use `.findEmmetMarker()` extension method in editor instance to get abbreviation marker. It’s mostly used to automatically display autocomplete popup when cursor enters abbreviation: if there’s marker for given cursor position then there’s valid abbreviation to expand.

If you experience issues with abbreviation marker, you can disable it by passing `markEmmetAbbreviation: false` option when creating editor instance or by setting this option to `false` with `editor.setOption()` method.
