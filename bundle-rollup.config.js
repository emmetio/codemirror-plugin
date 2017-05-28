'use strict';

import nodeResolve from 'rollup-plugin-node-resolve';
import buble from 'rollup-plugin-buble';
import uglify from 'rollup-plugin-uglify';

export default {
	entry: './browser.js',
	plugins: [
		nodeResolve(),
		buble(),
		uglify()
	],
	moduleName: 'emmetCodeMirrorPlugin',
	format: 'umd',
	dest: 'dist/emmet-codemirror-plugin.js',
	sourceMap: 'dist/emmet-codemirror-plugin.js.map'
};
