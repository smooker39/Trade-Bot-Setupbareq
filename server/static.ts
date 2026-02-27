import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // ✅ FIX: البحث عن dist/public بمسارات متعددة
  const candidatePaths = [
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(__dirname, "dist", "public"),
  ];

  let distPath: string | null = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      distPath = p;
      break;
    }
  }

  if (!distPath) {
    // ✅ FIX: بدل throw Error → نعرض صفحة تشخيص واضحة بدون تعطيل السيرفر
    console.warn(
      `⚠️ [STATIC] Frontend build not found. Run 'npm run build' to generate dist/public.`
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.status(503).send(`
        <html>
          <head><title>Predator Trading Bot</title>
          <style>body{background:#0a0f1e;color:#00d4ff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column}</style>
          </head>
          <body>
            <h1>⚡ Predator Engine - Backend Online</h1>
            <p>Frontend build not found. Run <code>npm run build</code> then restart.</p>
            <p>API Status: <a href="/api/health" style="color:#00ff88">/api/health</a></p>
          </body>
        </html>
      `);
    });
    return;
  }

  console.log(`✅ [STATIC] Serving frontend from: ${distPath}`);

  // ✅ تشغيل الملفات الثابتة
  app.use(express.static(distPath));

  // ✅ SPA fallback - كل route غير API يرجع index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    const indexPath = path.resolve(distPath!, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send("index.html not found inside dist/public. Rebuild required.");
    }
  });
}