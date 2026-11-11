import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Relative base so Capacitor's WebView can resolve bundled assets.
  base: './',
  plugins: [vue()],
})
