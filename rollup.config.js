'use strict';

import nodeResolve from 'rollup-plugin-node-resolve';

export default {
	entry: './plugin.js',
	plugins: [ nodeResolve() ],
	moduleName: 'emmetCodeMirrorPlugin',
	targets: [
		{ format: 'cjs', dest: 'dist/emmet-codemirror-plugin.cjs.js' },
		{ format: 'es',  dest: 'dist/emmet-codemirror-plugin.es.js' },
		{ format: 'umd',  dest: 'dist/emmet-codemirror-plugin.js' }
	]
};
