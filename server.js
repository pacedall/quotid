require('dotenv').config();
const path = require('path');
const express = require('express');
const { withUser } = require('./src/auth');

const app = express();
app.use(express.json());
app.use(withUser); // soft auth on every request

// API
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/era', require('./src/routes/era'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Pretty route for the game
app.get('/era', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'era.html')));
app.get('/reset', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'reset.html')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'era.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Quotid · Era running on :${PORT}`));
