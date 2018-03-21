'use strict';

import nodeResolve from 'rollup-plugin-node-resolve';
import buble from 'rollup-plugin-buble';
import uglify from 'rollup-plugin-uglify';

export default [{
	input: './extension.js',
	external: [
		'@emmetio/config',
		'@emmetio/expand-abbreviation',
		'@emmetio/extract-abbreviation',
		'@emmetio/css-snippets-resolver',
		'@emmetio/html-matcher',
		'@emmetio/stream-reader',
		'@emmetio/stream-reader-utils',
	],
	output: [{
		format: 'cjs',
		sourcemap: true,
		file: 'dist/emmet-codemirror-plugin.cjs.js'
	}, {
		format: 'es',
		sourcemap: true,
		file: 'dist/emmet-codemirror-plugin.es.js'
	}]
}, {
	input: './browser.js',
	plugins: [
		nodeResolve(),
		buble(),
		uglify()
	],
	output: {
		name: 'emmetCodeMirrorPlugin',
		format: 'umd',
		file: 'dist/emmet-codemirror-plugin.js',
		sourcemap: 'dist/emmet-codemirror-plugin.js.map'
	}
}];
