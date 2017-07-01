'use strict';

import nodeResolve from 'rollup-plugin-node-resolve';
import buble from 'rollup-plugin-buble';
import uglify from 'rollup-plugin-uglify';

const configNonMinified = {
	entry: './browser.js',
	plugins: [
		nodeResolve(),
		buble()
	],
	moduleName: 'emmetCodeMirrorPlugin',
	format: 'umd',
	dest: 'dist/emmet-codemirror-plugin.js',
	sourceMap: 'dist/emmet-codemirror-plugin.js.map'
};

const configMinified = Object.assign({}, configNonMinified);
configMinified.plugins = configMinified.plugins.concat(uglify());
configMinified.dest = 'dist/emmet-codemirror-plugin.min.js';
configMinified.sourceMap = 'dist/emmet-codemirror-plugin.min.js.map';

// Exporting multiple configs. Reference: https://github.com/rollup/rollupjs.org/blob/922d6abdffaa9584df88e5444529d917144c01f3/rollup.config.js
export default [
	configNonMinified,
	configMinified
];
