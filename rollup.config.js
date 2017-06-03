'use strict';

export default {
	entry: './extension.js',
	external: [
		'@emmetio/expand-abbreviation',
		'@emmetio/extract-abbreviation',
		'@emmetio/css-snippets-resolver',
		'@emmetio/html-matcher',
		'@emmetio/stream-reader'
	],
	targets: [
		{ format: 'cjs', dest: 'dist/emmet-codemirror-plugin.cjs.js' },
		{ format: 'es',  dest: 'dist/emmet-codemirror-plugin.es.js' },
	]
};
