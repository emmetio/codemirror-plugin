# Emmet 2 extension for CodeMirror editor

[CodeMirror](http://codemirror.net/) extension that adds [Emmet](https://emmet.io) support to text editor.

---
*Extension development is sponsored by [CodePen](https://codepen.io).*
---

## How to use

This extension can be installed as a regular npm module:

```
npm install --save @emmetio/codemirror-plugin
```

The package itself follows CodeMirror extension convention and simply registers new commands and some extension methods. In order to use Emmet, you should create CodeMirror instance and provide keymap with Emmet actions. Currently, this extension registers only 2 actions:

* `emmetExpandAbbreviation` – expand abbreviation from current cursor position.
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
## Autocomplete provider

The new Emmet 2 concept suggests that Emmet should be used as autocomplete provider: it gives user full control over Tab key, editors’ native snippets and provides real-time preview of expanded abbreviation.

CodeMirror doesn’t have native autocomplete support but provides fully optional [show-hint](http://codemirror.net/doc/manual.html#addon_show-hint) module. To add autocomplete support into your CodeMirror instance, call `.getEmmetCompletions()` extension method in editor instance and use its result as a provider for autocomplete extension. This method returns object with the following properties:

* `from` and `to` properties describe range of matched Emmet abbreviation in editor.
* `list` contains list of completions with the following properties:
	* `type`: type of completion item, either `expanded-abbreviation` or `snippet`.
	* `range`: object with `from` and `to` properties that describe range of editor content to be replaced with current completion item. Note that for `expanded-abbreviation` item type this range matches full abbreviation, while for `snippet` type it matches only a part of abbreviation.
	* `label`: completion display label.
	* `preview`: preview of expanded completion item.
	* `insert()`: a method that applies current completion item to editor.

For a complete example of how to use Emmet completions with `show-hint` module, see `example.html` file.

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
	// `markupSnippets` are used for markup languages like HTML, Slim, Pug etc.,
	// `stylesheetSnippets` are used for stylesheet syntaxes like CSS, LESS etc.
	// Since a single editor may contain mixed syntaxes, you should
	// explicitly separate markup and stylesheet syntaxes instead of passing
	// a single `snippets` property, as described in `@emmetio/expand-abbreviation`
	// module
	emmet: {
		markupSnippets: {
			foo: 'div.foo[bar=baz]'
		},
		stylesheetSnippets: {
			myp: 'my-super: property'
		}
	}
});
```

Note that markup and stylesheet snippet definitions are different. Markup snippets are written as Emmet abbreviations (e.g. you simply describe element name and its default attributes) while stylesheet snippets are aliases to CSS properties with optional keywords list, separated by `|` character. These keywords are used in abbreviation resolving process. For more examples, see [@emmetio/snippets](http://github.com/emmetio/snippets) repo.

## How it works

In order to provide a predictable completions list, this extension automatically marks Emmet abbreviation as a [text marker](https://codemirror.net/doc/manual.html#api_marker) when user types text in editor. This marker is automatically re-validated on change and destroyed when user edits different part of code. The marker has `.emmet-abbreviation` class and can be styled via CSS to give users a clue what part of text will be expanded as abbreviation. Also, this marker contains `.model` property with extracted and parsed abbreviation.

The main reason to use text marker is to allow user to edit entered abbreviation and maintain proper autocomplete and abbreviation expansion context. You can use `.findEmmetMarker()` extension method in editor instance to get abbreviation marker. It’s mostly used to automatically display autocomplete popup when cursor enters abbreviation: if there’s marker for given cursor position then there’s valid abbreviation to expand.

If you experience issues with abbreviation marker, you can disable it by passing `markEmmetAbbreviation: false` option when creating editor instance or by setting this option to `false` with `editor.setOption()` method.
