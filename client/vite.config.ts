import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // AG Grid weighs about 1.2 MB. It is only loaded on the admin pages (React.lazy in App.tsx),
  // so the warning "Some chunks are larger than 500 kB" is expected: the limit is raised.
  build: { chunkSizeWarningLimit: 1300 },
});
