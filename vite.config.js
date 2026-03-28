import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isProduction = command === 'build'
  const PROXY_BASE = '/proxy/5173'

  // Solo usamos el fix del proxy si NO estamos en producción
  const baseConfig = isProduction ? './' : (PROXY_BASE + '/')

  return {
    plugins: [
      react(),
      // Solo activamos el plugin de fix si estamos desarrollando en code-server
      !isProduction && codeServerProxyPlugin(PROXY_BASE)
    ].filter(Boolean),
    
    base: baseConfig,

    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: ['code-server.digitalpartners.es'],
      hmr: false,
    },
    
    // Esto asegura que el build ignore cualquier variable de entorno del proxy
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  }
})

// Mantén tu función codeServerProxyPlugin aquí abajo igual que la tienes...
function codeServerProxyPlugin(base) {
  const prefix = '/' + base.replace(/^\/|\/$/g, '') + '/'
  return {
    name: 'code-server-proxy-fix',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && !req.url.startsWith(prefix)) {
          req.url = prefix + req.url.replace(/^\//, '')
        }
        next()
      })
    },
  }
}