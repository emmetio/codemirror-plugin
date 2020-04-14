import typescript from 'rollup-plugin-typescript2';
import nodeResolve from 'rollup-plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

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
        file: 'dist/extension.cjs.js',
        format: 'cjs',
        sourcemap: true
    }, {
        file: 'dist/extension.es.js',
        format: 'es',
        sourcemap: true
    }]
}, {
    input: './src/browser.ts',
    plugins: plugins().concat(process.env.NODE_ENV === 'production' ? terser() : null),
    output: [{
        file: 'dist/browser.js',
        format: 'umd',
        sourcemap: true
    }]
}];
