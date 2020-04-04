import typescript from 'rollup-plugin-typescript2';
import nodeResolve from 'rollup-plugin-node-resolve';

function plugins() {
    return [nodeResolve(), typescript({
        tsconfigOverride: {
            compilerOptions: { module: 'esnext' }
        }
    })];
}

export default [{
    input: './src/extension.ts',
    plugins: plugins(),
    output: [{
        file: 'dist/emmet-codemirror-plugin.cjs.js',
        format: 'cjs',
        sourcemap: true
    }, {
        file: 'dist/emmet-codemirror-plugin.es.js',
        format: 'es',
        sourcemap: true
    }]
}, {
    input: './src/browser.ts',
    plugins: plugins(),
    output: [{
        file: 'dist/emmet-codemirror-plugin.js',
        format: 'umd',
        sourcemap: true
    }]
}];
