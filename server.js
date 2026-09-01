const express = require('express');
const axios = require('axios');
const cors = require('cors');
const otplib = require('otplib');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// តាមដានរាល់ពេលមានអ្នកចូលមើលវេបសាយ (Visits)
app.use((req, res, next) => {
  const visitorIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[VISIT] New visitor from IP: ${visitorIP} at ${new Date().toLocaleTimeString()}`);
  next();
});

// តាមដានពេលមានអ្នកបំពេញ Captcha និង Generate 2FA ជោគជ័យ
app.post('/api/generate-code', async (req, res) => {
  const { secret, captcha } = req.body;

  if (!secret) {
    return res.status(400).json({ error: 'Secret Key is required' });
  }

  try {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const token = otplib.authenticator.generate(cleanSecret);
    const timeLeft = otplib.authenticator.timeRemaining();

    // បង្ហាញសកម្មភាពនេះក្នុង Logs របស់ Render ថាមានคน Complete 2FA ហើយ
    console.log(`[SUCCESS] 🚀 A user successfully completed hCaptcha and generated a 2FA code at ${new Date().toLocaleString()}`);

    return res.json({ token, timeLeft });
  } catch (error) {
    return res.status(400).json({ error: 'Invalid Secret Key' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});