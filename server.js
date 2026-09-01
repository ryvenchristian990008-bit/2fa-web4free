const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { authenticator } = require('otplib');
const path = require('path');

const app = express();

// អនុញ្ញាតការតភ្ជាប់ពី Frontend និងប្រើប្រាស់ទម្រង់ JSON
app.use(cors());
app.use(express.json());

// បន្ថែមបន្ទាត់នេះ ដើម្បីឱ្យ Server បង្ហាញឯកសារ index.html របស់អ្នកដោយស្វ័យប្រវត្តិ
app.use(express.static(__dirname));

// hCaptcha Secret Key របស់អ្នក
const HCAPTCHA_SECRET_KEY = 'ES_fd3a4b3a007f4b63b034f8a4ce45670e';

app.post('/api/generate-code', async (req, res) => {
    const { secret, captcha } = req.body;

    if (!secret || !captcha) {
        return res.status(400).json({ error: 'ទាមទារ 2FA Secret Key និងការដោះស្រាយ Captcha!' });
    }

    try {
        const verifyUrl = 'https://hcaptcha.com/siteverify';
        const params = new URLSearchParams();
        params.append('secret', HCAPTCHA_SECRET_KEY);
        params.append('response', captcha);

        const captchaResponse = await axios.post(verifyUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!captchaResponse.data.success) {
            return res.status(403).json({ error: 'ការផ្ទៀងផ្ទាត់ Captcha បរាជ័យ! សូមព្យាយាមម្តងទៀត។' });
        }

        const token = authenticator.generate(secret);
        const timeLeft = authenticator.timeRemaining();

        res.json({ token, timeLeft });

    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ error: 'មានបញ្ហានៅលើ Server ខាងក្នុង។' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ វេបសាយកំពុងដំណើរការនៅលើ Port: ${PORT}`);
});