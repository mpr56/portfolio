import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: {
    rollupOptions: {
      output: {
        // Split the engine out so app edits don't invalidate a ~700KB chunk.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('@react-three') || id.includes('postprocessing')) return 'r3f'
        },
      },
    },
  },
})
