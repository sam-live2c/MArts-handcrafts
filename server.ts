import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import sendOtpHandler from './api/send-otp';
import verifyOtpHandler from './api/verify-otp';
import resendStatusHandler from './api/resend-status';
import apiIndexHandler from './api/index';
import authSecurityHandler from './api/auth-security';
import orderSecurityHandler from './api/order-security';
import { securityHeadersMiddleware, globalTrafficLimiter, injectionGuardMiddleware } from './api/security';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const portFromArgs = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
const PORT = portFromArgs || Number(process.env.PORT) || 3000;

// Trust proxy for accurate client IP rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Standard HTTP Security Headers & Global Volumetric Rate Limiter
app.use(securityHeadersMiddleware);
app.use(globalTrafficLimiter);

app.use(cors());
// Generous JSON body size limits to accommodate customization assets and large orders
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Graceful error handling for body-parser payload limits and malformed JSON
app.use((err: any, _req: Request, res: Response, next: any) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError')) {
    return res.status(413).json({
      success: false,
      error: 'Request payload too large. Please reduce file size or quantity.'
    });
  }
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
  }
  next(err);
});

// Injection & Attack Payload Guard
app.use(injectionGuardMiddleware);

// ================= SEO & CRAWLER ROUTES =================
app.get(['/robots.txt', '/robot.txt'], (_req, res) => {
  res.type('text/plain');
  res.sendFile(path.resolve(__dirname, 'public/robots.txt'));
});
app.get('/sitemap.txt', (_req, res) => {
  res.type('text/plain');
  res.sendFile(path.resolve(__dirname, 'public/sitemap.txt'));
});
app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml');
  res.sendFile(path.resolve(__dirname, 'public/sitemap.xml'));
});

// ================= API ROUTES =================
app.all('/api/send-otp', (req, res) => sendOtpHandler(req, res));
app.all('/api/verify-otp', (req, res) => verifyOtpHandler(req, res));
app.all('/api/resend-status', (req, res) => resendStatusHandler(req, res));
app.all('/api/auth-security', (req, res) => authSecurityHandler(req, res));
app.all('/api/order-security', (req, res) => orderSecurityHandler(req, res));
app.all('/api', (req, res) => apiIndexHandler(req, res));

// ================= FRONTEND MOUNTING =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite dev server middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] MArts Express + Vite running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[Server Error] Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
