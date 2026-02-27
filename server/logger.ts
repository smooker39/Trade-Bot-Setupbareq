import winston from 'winston';
import { storage } from './storage';

// Configure custom logger to match requested format
// RotatingFileHandler equivalent in Node
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss,SSS' // Match Python's default asctime
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} - AI_QI_COINS - ${level.toUpperCase()} - ${message}`;
    })
  ),
  transports: [
    // Console output
    new winston.transports.Console(),
    // File output (Rotating)
    new winston.transports.File({ 
      filename: 'app_trading.log',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    })
  ]
});

// Helper to also log to DB for the frontend
export const log = {
  info: (message: string) => {
    logger.info(message);
    storage.createLog({ level: 'info', message }).catch(console.error);
  },
  error: (message: string) => {
    logger.error(message);
    storage.createLog({ level: 'error', message }).catch(console.error);
  },
  warn: (message: string) => {
    logger.warn(message);
    storage.createLog({ level: 'warning', message }).catch(console.error);
  }
};
