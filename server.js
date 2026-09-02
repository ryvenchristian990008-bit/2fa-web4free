const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Admin statistics storage
let siteStats = {
    totalVisitors: 0,
    totalGenerations: 0,
    generationLogs: []
};

// Automatic visitor tracking middleware
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '') {
        siteStats.totalVisitors++;
    }
    next();
});

// API for Admin login with updated passcode 171204
app.post('/api/admin/login', (req, res) => {
    const { passcode } = req.body;
    const ADMIN_SECRET = "171204"; // Updated admin passcode

    if (passcode === ADMIN_SECRET) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Incorrect Passcode' });
    }
});

// API for code generation logs
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

// API for admin analytics stats
app.get('/api/admin/stats', (req, res) => {
    res.json(siteStats);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GlobalAuth web server running successfully on port ${PORT}`);
});