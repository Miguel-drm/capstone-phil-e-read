import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    jsxImportSource: '@emotion/react',
    babel: {
      plugins: ['@emotion/babel-plugin'],
    },
  })],
  optimizeDeps: {
    include: ['multer-gridfs-storage'],
    // Force pre-bundle MUI to reduce file handles during build
    force: false,
    esbuildOptions: {
      // Increase file handle limit for esbuild
      logLimit: 0,
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Optimize chunking to avoid file handle issues
          if (id.includes('node_modules')) {
            // Group all MUI icons into a single chunk to reduce file handles
            if (id.includes('@mui/icons-material')) {
              return 'mui-icons';
            }
            // Split other vendors
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'ui-vendor';
            }
            if (id.includes('chart.js') || id.includes('echarts')) {
              return 'chart-vendor';
            }
            if (id.includes('axios') || id.includes('date-fns') || id.includes('sweetalert2')) {
              return 'utils-vendor';
            }
            // Group remaining node_modules
            return 'vendor';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      // Increase max parallel file reads to handle large dependencies
      maxParallelFileOps: 20,
    },
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minify CSS
    cssMinify: true,
    // Enable source maps for production debugging (optional)
    sourcemap: false,
    // Optimize dependencies - use esbuild (faster and built-in)
    minify: 'esbuild',
    // Optimize asset inlining
    assetsInlineLimit: 4096, // 4kb - inline smaller assets as base64
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
})
