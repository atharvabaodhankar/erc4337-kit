import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.js'],

  format: ['esm', 'cjs'],

  dts: false,

  splitting: false,

  sourcemap: true,

  clean: true,

  treeshake: true,

  external: [
    'react',
    'react-dom',
    '@privy-io/react-auth',
    '@privy-io/wagmi',
    'viem',
    'wagmi',
    '@tanstack/react-query',
  ],

  esbuildOptions(options) {
    options.conditions = ['module']
  },
})
