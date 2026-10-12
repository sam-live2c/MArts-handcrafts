export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const data = {
    name: 'MArts Backend API',
    status: 'online',
    endpoints: [
      '/api/send-otp',
      '/api/verify-otp',
      '/api/resend-status'
    ]
  };

  if (typeof res.status === 'function') {
    res.status(200).json(data);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
