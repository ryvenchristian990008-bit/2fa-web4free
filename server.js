const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ទុកទិន្នន័យស្ថិតិសម្រាប់ Admin Dashboard
let siteStats = {
    totalVisitors: 0,
    totalGenerations: 0,
    generationLogs: []
};

// រាប់ចំនួនអ្នកចូលទស្សនាវេបសាយស្វ័យប្រវត្តិ
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '') {
        siteStats.totalVisitors++;
    }
    next();
});

// API សម្រាប់ផ្ទៀងផ្ទាត់ Admin Passcode (អ្នកអាចប្តូរលេខកូដសម្ងាត់នៅទីនេះបាន)
app.post('/api/admin/login', (req, res) => {
    const { passcode } = req.body;
    const ADMIN_SECRET = "admin123"; // <-- ផ្លាស់ប្តូរលេខកូដសម្ងាត់ថ្មីរបស់អ្នកនៅទីនេះ

    if (passcode === ADMIN_SECRET) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Incorrect Passcode' });
    }
});

// API សម្រាប់ Generate Code និងកត់ត្រាប្រវត្តិ
app.post('/api/generate-code', (req, res) => {
    const { secret } = req.body;
    if (!secret) {
        return res.status(400).json({ error: 'Secret key is required' });
    }

    const mockToken = Math.floor(100000 + Math.random() * 900000).toString();
    
    siteStats.totalGenerations++;
    siteStats.generationLogs.unshift({
        code: mockToken,
        time: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString()
    });

    if (siteStats.generationLogs.length > 50) {
        siteStats.generationLogs.pop();
    }

    res.json({ token: mockToken, timeLeft: 30 });
});

// API សម្រាប់ឱ្យ Admin ទាញយកទិន្នន័យស្ថិតិ
app.get('/api/admin/stats', (req, res) => {
    res.json(siteStats);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GlobalAuth web server running successfully on port ${PORT}`);
});