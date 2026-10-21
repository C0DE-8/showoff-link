import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

function resolveSiteOrigin(env) {
  const vercelHost = process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    : process.env.VERCEL_URL
  const configured = env.VITE_SITE_URL || vercelHost || 'http://localhost:5173'
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  return withProtocol.replace(/\/$/, '')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteOrigin = resolveSiteOrigin(env)

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      {
        name: 'inject-deployment-site-origin',
        transformIndexHtml: (html) => html.replaceAll('__SITE_ORIGIN__', siteOrigin),
      },
    ],
  }
})
