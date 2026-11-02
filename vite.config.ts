import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createTTSMiddleware } from './server/ttsMiddleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs: the same build works at a domain root and under a sub-path (GitHub Pages)
  base: './',
  plugins: [
    react(),
    {
      name: 'edge-tts-server',
      configureServer(server) {
        // Mount Edge-TTS API middleware
        server.middlewares.use(createTTSMiddleware())

        // Fallback for onnx wasm streaming if needed
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/onnx/')) {
            const cleanUrl = req.url.split('?')[0].replace('/onnx/', '')
            const filePath = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist', cleanUrl)

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              if (filePath.endsWith('.wasm')) {
                res.setHeader('Content-Type', 'application/wasm')
              } else if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript')
              }
              res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
              return fs.createReadStream(filePath).pipe(res)
            }
          }
          next()
        })
      },
    },
  ],
})

