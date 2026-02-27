/**
 * 🔐 AUTO-SETUP - Render/Cloud Deployment Safe
 *
 * ✅ FIX: لا توجد credentials مكشوفة في الكود.
 * المفاتيح تُقرأ حصرياً من Environment Variables (Secrets).
 * ضع هذه المتغيرات في Render → Environment:
 *   OKX_API_KEY, OKX_API_SECRET, OKX_PASSPHRASE
 *   SESSION_SECRET, DATABASE_URL
 */

import { storage } from "./storage";
import { log } from "./logger";

export async function autoSetup() {
  try {
    const apiKey = process.env.OKX_API_KEY?.trim();
    const secret = process.env.OKX_API_SECRET?.trim();
    const passphrase = process.env.OKX_PASSPHRASE?.trim();

    if (!apiKey || !secret || !passphrase) {
      log.warn(
        "⚠️ [AUTO-SETUP] OKX credentials not found in environment. Skipping auto-setup."
      );
      log.warn(
        "⚠️ [AUTO-SETUP] Set OKX_API_KEY, OKX_API_SECRET, OKX_PASSPHRASE in your environment."
      );
      return;
    }

    // تحقق هل الـ credentials موجودة مسبقاً في DB
    const existing = await storage.getUser();
    if (existing && existing.okxApiKey === apiKey) {
      log.info("✅ [AUTO-SETUP] Credentials already configured. Skipping.");
      return;
    }

    // حفظ في قاعدة البيانات
    await storage.createOrUpdateUser({
      okxApiKey: apiKey,
      okxSecret: secret,
      okxPassword: passphrase,
    });

    log.info("✅ [AUTO-SETUP] OKX credentials loaded from environment successfully.");
  } catch (error: any) {
    log.error(`❌ [AUTO-SETUP] Failed: ${error.message}`);
  }
}