/**
 * 🚀 AUTO-SETUP SCRIPT - UPDATED FOR SEJO
 * * This script automatically configures your OKX credentials
 * on first run if they don't exist in the database.
 */

import { storage } from './storage';
import { log } from './logger';

const AUTO_CREDENTIALS = {
  okxApiKey: '370b3ba0-6ebc-4d9e-b0ec-4af81d6dc40a',
  okxSecret: '0C18D445E5A0D23FAF40E1F15A87EA8F',
  okxPassword: '@Sejo_20'
};

export async function autoSetup() {
  try {
    // إجبار النظام على التحديث بالمفاتيح الجديدة
    log.info('🔧 [AUTO-SETUP] Forcing update with new Sejo credentials...');
    
    // حفظ أو تحديث البيانات مباشرة في قاعدة البيانات
    await storage.createOrUpdateUser({
      okxApiKey: AUTO_CREDENTIALS.okxApiKey,
      okxSecret: AUTO_CREDENTIALS.okxSecret,
      okxPassword: AUTO_CREDENTIALS.okxPassword
    });
    
    log.info('✅ [AUTO-SETUP] Credentials configured successfully!');
    log.info('✅ [AUTO-SETUP] System ready to trade with 10.26 USDT');
    
  } catch (error: any) {
    log.error(`❌ [AUTO-SETUP] Failed: ${error.message}`);
  }
}
