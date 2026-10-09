import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: {
    rolldownOptions: {
      output: {
        // Split the engine out so app edits don't invalidate a ~700KB chunk.
        //
        // React needs a group of its own, claimed first. A group takes its
        // dependencies with it, so otherwise r3f swallows React, the entry has
        // to import r3f, and the simple view ends up downloading three.js.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              priority: 3,
            },
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 2 },
            { name: 'r3f', test: /@react-three|postprocessing/, priority: 1 },
          ],
        },
      },
    },
  },
})
