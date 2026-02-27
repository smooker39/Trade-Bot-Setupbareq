import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// تعديل جوهري: استبدال fileURLToPath بطريقة متوافقة أكثر مع Replit
const __dirname = path.resolve();

export function serveStatic(app: Express) {
  // تصحيح مسار مجلد البناء (Build)
  const distPath = path.resolve(__dirname, "dist", "public");
  
  if (!fs.existsSync(distPath)) {
    // محاولة ثانية للبحث عن المسار إذا كان السيرفر شغال من داخل مجلد dist
    const altPath = path.resolve(__dirname, "..", "dist", "public");
    if (!fs.existsSync(altPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
  }

  // تشغيل الملفات الثابتة (الصور، التنسيقات، ملفات الـ JS)
  app.use(express.static(distPath));

  // ضمان عمل صفحة الـ SPA وتوجيه الروابط بشكل صحيح
  app.get(/^(?!\/api).*/, (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Front-end build not found. Please run 'npm run build' first.");
    }
  });
}
