import {
  RESEND_API_KEY,
  RESEND_FROM_EMAIL
} from '../utils/otp';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(200).end();
    } else {
      res.writeHead(200);
      res.end();
    }
    return;
  }

  const hasKey = Boolean(RESEND_API_KEY && RESEND_API_KEY.startsWith('re_'));
  const data = {
    status: 'ok',
    resendConfigured: hasKey,
    fromEmail: RESEND_FROM_EMAIL,
    keyPrefix: hasKey ? RESEND_API_KEY.slice(0, 7) + '...' : 'none'
  };

  if (typeof res.status === 'function') {
    res.status(200).json(data);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
