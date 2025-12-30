const express = require('express');
const path = require('path');
const cors = require('cors');
const storage = require('./storage');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'skilloc_secret_change_me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
// Lockout policy for clients
const MAX_FAILED = 5; // max allowed consecutive failed attempts
const LOCK_MINUTES = 15; // lockout duration in minutes

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files (dash.html, client.html, worker.html, css)
app.use(express.static(path.join(__dirname)));

const SERVICES = [
  { id: 'electrician', name: 'Electrician' },
  { id: 'plumber', name: 'Plumber' },
  { id: 'mechanic', name: 'Mechanic' },
  { id: 'carpenter', name: 'Carpenter' }
];

app.get('/api/services', (req, res) => {
  res.json(SERVICES);
});

// Protected profile endpoint using JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const { id, type } = req.user;
    if (type === 'client') {
      const clients = await storage.readData('data/clients.json');
      const user = clients.find(u => u.id === id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password, ...rest } = user;
      return res.json({ success: true, user: rest });
    }
    if (type === 'worker') {
      const workers = await storage.readData('data/workers.json');
      const user = workers.find(u => u.id === id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password, ...rest } = user;
      return res.json({ success: true, user: rest });
    }
    return res.status(400).json({ error: 'Unknown type' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register client
app.post('/api/client/register', async (req, res) => {
  try {
    const payload = req.body || {};
    const required = ['firstName', 'email', 'password', 'city'];
    for (const f of required) {
      if (!payload[f]) return res.status(400).json({ error: `${f} is required` });
    }

    const clients = await storage.readData('data/clients.json');
    if (clients.find(c => c.email === payload.email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // hash password before storing
    const hashed = await bcrypt.hash(payload.password, 10);

    const newClient = {
      id: Date.now().toString(),
      firstName: payload.firstName,
      lastName: payload.lastName || '',
      email: payload.email,
      phone: payload.phone || '',
      city: payload.city || '',
      address: payload.address || '',
      services: payload.services || [],
      radius: payload.radius || null,
      password: hashed
    };

    clients.push(newClient);
    await storage.writeData('data/clients.json', clients);
    res.json({ success: true, user: { id: newClient.id, email: newClient.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register worker
app.post('/api/worker/register', async (req, res) => {
  try {
    const payload = req.body || {};
    const required = ['firstName', 'email', 'password', 'profession'];
    for (const f of required) {
      if (!payload[f]) return res.status(400).json({ error: `${f} is required` });
    }

    const workers = await storage.readData('data/workers.json');
    if (workers.find(w => w.email === payload.email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(payload.password, 10);

    const newWorker = {
      id: Date.now().toString(),
      firstName: payload.firstName,
      lastName: payload.lastName || '',
      email: payload.email,
      phone: payload.phone || '',
      profession: payload.profession,
      experience: payload.experience || 0,
      skills: payload.skills || '',
      certifications: payload.certifications || '',
      hourlyRate: payload.hourlyRate || null,
      serviceRadius: payload.serviceRadius || null,
      latitude: typeof payload.latitude === 'number' ? payload.latitude : (payload.latitude ? Number(payload.latitude) : null),
      longitude: typeof payload.longitude === 'number' ? payload.longitude : (payload.longitude ? Number(payload.longitude) : null),
      password: hashed
    };

    workers.push(newWorker);
    await storage.writeData('data/workers.json', workers);
    res.json({ success: true, user: { id: newWorker.id, email: newWorker.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Simple login for client or worker
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, type } = req.body || {};
    if (!email || !password || !type) return res.status(400).json({ error: 'email, password and type are required' });

    if (type === 'client') {
      const clients = await storage.readData('data/clients.json');
      const user = clients.find(u => u.email === email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      // Initialize tracking fields if missing
      user.failedAttempts = user.failedAttempts || 0;
      user.lockedUntil = user.lockedUntil || null;

      // Check if account is currently locked
      if (user.lockedUntil && Date.now() < user.lockedUntil) {
        const until = new Date(user.lockedUntil).toISOString();
        return res.status(403).json({ error: `Account locked until ${until}` });
      }

      let valid = false;
      if (typeof user.password === 'string' && user.password.startsWith('$2')) {
        valid = await bcrypt.compare(password, user.password);
      } else {
        if (password === user.password) {
          valid = true;
          user.password = await bcrypt.hash(password, 10);
        }
      }

      if (!valid) {
        // Increment failed attempts and possibly lock account
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        if (user.failedAttempts >= MAX_FAILED) {
          user.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
        }
        await storage.writeData('data/clients.json', clients);
        const msg = user.lockedUntil ? `Account locked for ${LOCK_MINUTES} minutes` : 'Invalid credentials';
        return res.status(401).json({ error: msg });
      }

      // Successful login: reset failed attempts and lock
      user.failedAttempts = 0;
      user.lockedUntil = null;
      await storage.writeData('data/clients.json', clients);

      const token = jwt.sign({ id: user.id, email: user.email, type: 'client' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return res.json({ success: true, token, user: { id: user.id, email: user.email, type: 'client' } });
    }

    if (type === 'worker') {
      const workers = await storage.readData('data/workers.json');
      const user = workers.find(u => u.email === email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      let valid = false;
      if (typeof user.password === 'string' && user.password.startsWith('$2')) {
        valid = await bcrypt.compare(password, user.password);
      } else {
        if (password === user.password) {
          valid = true;
          user.password = await bcrypt.hash(password, 10);
          await storage.writeData('data/workers.json', workers);
        }
      }

      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      // Update worker.db on successful login
      const workerDb = await storage.readData('data/worker.db');
      const loginRecord = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profession: user.profession,
        phone: user.phone,
        lastLogin: new Date().toISOString(),
        status: 'online'
      };

      // Check if worker already exists in db, if so update, otherwise add
      const existingIndex = workerDb.findIndex(w => w.id === user.id);
      if (existingIndex >= 0) {
        workerDb[existingIndex] = loginRecord;
      } else {
        workerDb.push(loginRecord);
      }
      await storage.writeData('data/worker.db', workerDb);

      const token = jwt.sign({ id: user.id, email: user.email, type: 'worker' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return res.json({ success: true, token, user: { id: user.id, email: user.email, type: 'worker' } });
    }

    res.status(400).json({ error: 'Unknown type' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search nearby workers by category and coordinates
app.post('/api/nearby', async (req, res) => {
  try {
    const { category, lat, lng } = req.body || {};
    if (!category || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'category, lat and lng are required' });
    }

    const workers = await storage.readData('data/workers.json');

    // Haversine distance in meters
    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371000; // meters
      const toRad = v => v * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const MAX_METERS = 5; // per user request: maximum distance to consider

    // Filter workers that have coordinates and match the requested profession/category
    const matched = (workers || []).filter(w => {
      if (!w) return false;
      const prof = (w.profession || '').toString().toLowerCase();
      const wanted = category.toString().toLowerCase();
      // Must have latitude/longitude stored on worker profile
      if (typeof w.latitude !== 'number' || typeof w.longitude !== 'number') return false;
      // Simple match: profession contains the category or vice versa
      if (!(prof.includes(wanted) || wanted.includes(prof))) return false;
      const d = distanceMeters(lat, lng, w.latitude, w.longitude);
      return d <= MAX_METERS;
    }).map(w => ({ id: w.id, firstName: w.firstName, lastName: w.lastName, email: w.email, phone: w.phone, profession: w.profession, latitude: w.latitude, longitude: w.longitude }));

    return res.json({ workers: matched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Client-friendly search: accepts { category, lat, lng } OR uses authenticated client's stored coordinates
app.post('/api/client/search', async (req, res) => {
  try {
    const { category, lat, lng } = req.body || {};
    let useLat = lat;
    let useLng = lng;

    // If lat/lng not provided, try to use authenticated client's stored coordinates
    const auth = req.headers.authorization || req.headers.Authorization;
    if ((typeof useLat !== 'number' || typeof useLng !== 'number') && auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload && payload.type === 'client') {
          const clients = await storage.readData('data/clients.json');
          const user = clients.find(u => u.id === payload.id);
          if (user) {
            if (typeof user.latitude === 'number' && typeof user.longitude === 'number') {
              useLat = user.latitude;
              useLng = user.longitude;
            }
          }
        }
      } catch (e) {
        // ignore token errors and fall back to provided coords
      }
    }

    if (typeof category !== 'string' || !category) return res.status(400).json({ error: 'category is required' });
    if (typeof useLat !== 'number' || typeof useLng !== 'number') return res.status(400).json({ error: 'lat and lng are required (or provide an authenticated client with stored coordinates)' });

    const workers = await storage.readData('data/workers.json');

    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371000; // meters
      const toRad = v => v * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const MAX_METERS = 5000; // allow a larger default radius for client searches

    const wanted = category.toString().toLowerCase();
    const matched = (workers || []).filter(w => {
      if (!w) return false;
      const prof = (w.profession || '').toString().toLowerCase();
      if (typeof w.latitude !== 'number' || typeof w.longitude !== 'number') return false;
      if (!(prof.includes(wanted) || wanted.includes(prof))) return false;
      const d = distanceMeters(useLat, useLng, w.latitude, w.longitude);
      return d <= MAX_METERS;
    }).map(w => ({ id: w.id, firstName: w.firstName, lastName: w.lastName, email: w.email, phone: w.phone, profession: w.profession, latitude: w.latitude, longitude: w.longitude }));

    return res.json({ workers: matched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fallback route to serve dashboard
app.get('*', (req, res) => {
  // If requesting an API path, return 404
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'dash.html'));
});

app.listen(PORT, () => {
  console.log(`Skilloc backend running on http://localhost:${PORT}`);
});
