/* eslint-disable node/no-extraneous-import */
/* eslint-disable node/no-unpublished-import */
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {defineConfig} from 'rollup';
import {terser} from 'rollup-plugin-terser';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'build',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].mjs',
  },
  treeshake: true,
  plugins: [
    nodeResolve({preferBuiltins: true}),
    typescript(),
    commonjs(),
    false && terser(),
  ],
});
