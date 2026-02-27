import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ✅ FIX: تمت إزالة Replit plugins لضمان البيلد خارج Replit
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    // ✅ FIX: المسار الصحيح لمجلد البناء
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    fs: {
      strict: false,
    },
  },
});