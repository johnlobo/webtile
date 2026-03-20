import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PROXY_BASE = '/proxy/5173'

/**
 * code-server strips /proxy/PORT from every request before forwarding to Vite.
 * This plugin adds the prefix back so Vite can match its own `base` correctly,
 * avoiding the redirect loop and broken absolute-path imports.
 */
function codeServerProxyPlugin(base) {
  const prefix = '/' + base.replace(/^\/|\/$/g, '') + '/'
  return {
    name: 'code-server-proxy-fix',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url.startsWith(prefix)) {
          req.url = prefix + req.url.replace(/^\//, '')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), codeServerProxyPlugin(PROXY_BASE)],
  base: PROXY_BASE + '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['code-server.digitalpartners.es'],
    // HMR desactivado: el WebSocket no es estable a través del proxy de code-server
    // y causa recargas automáticas inesperadas. Recarga manual tras cambios en código.
    hmr: false,
  },
})
