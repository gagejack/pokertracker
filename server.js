const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Debug environment variables
console.log('Environment variables loaded:');
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

// Set a default JWT_SECRET if not in environment
if (!process.env.JWT_SECRET) {
    console.log('Setting default JWT_SECRET');
    process.env.JWT_SECRET = 'poker-tracker-secret-key-2024';
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker-tracker')
  .then(() => {
    console.log('Connected to MongoDB');
    // Create initial admin user after successful connection
    createInitialAdmin();
  })
  .catch(err => {
    console.error('Could not connect to MongoDB:', err);
    process.exit(1); // Exit if we can't connect to the database
  });

// Add connection error handler
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

// Add disconnection handler
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Add reconnection handler
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const Admin = mongoose.model('Admin', adminSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Player Schema
const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  stats: {
    totalSessions: { type: Number, default: 0 },
    totalBuyins: { type: Number, default: 0 },
    totalCashouts: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    biggestWin: { type: Number, default: 0 },
    biggestLoss: { type: Number, default: 0 }
  }
});

const Player = mongoose.model('Player', playerSchema);

// Admin Routes
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);
    
    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username });
    console.log('Admin found:', !!admin);

    if (!admin) {
      console.log('No admin found with username:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Comparing passwords...');
    const validPassword = await bcrypt.compare(password, admin.password);
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      console.log('Invalid password for username:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ username: admin.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    console.log('Login successful for username:', username);
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

// Create initial admin user if none exists
async function createInitialAdmin() {
  try {
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      console.log('Initial admin user created');
    }
  } catch (error) {
    console.error('Error creating initial admin:', error);
  }
}

// Add this before the other routes
app.post('/api/admin/reset', async (req, res) => {
  try {
    // Delete existing admin if any
    await Admin.deleteMany({ username: 'admin' });
    
    // Create new admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const newAdmin = await Admin.create({
      username: 'admin',
      password: hashedPassword
    });
    
    console.log('Admin user reset successfully');
    res.json({ message: 'Admin user reset successfully' });
  } catch (error) {
    console.error('Error resetting admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// API Routes
app.get('/api/players', async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const player = new Player({
      name: req.body.name,
      stats: req.body.stats
    });
    const newPlayer = await player.save();
    res.status(201).json(newPlayer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/players/:name', async (req, res) => {
  try {
    const player = await Player.findOneAndUpdate(
      { name: req.params.name },
      { stats: req.body.stats },
      { new: true }
    );
    res.json(player);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add DELETE endpoint
app.delete('/api/players/:name', async (req, res) => {
  try {
    const player = await Player.findOneAndDelete({ name: req.params.name });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update reset stats endpoint to require authentication
app.post('/api/reset-stats', authenticateToken, async (req, res) => {
  try {
    // Delete all players instead of just resetting their stats
    await Player.deleteMany({});
    res.json({ message: 'All players and their stats have been reset' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this after the other API routes
app.put('/api/stats/:gameType/:playerName', authenticateToken, async (req, res) => {
    try {
        const { gameType, playerName } = req.params;
        const stats = req.body;

        console.log('Updating stats for:', { gameType, playerName, stats });

        // Validate the stats object
        if (!stats || typeof stats !== 'object') {
            console.log('Invalid stats data received:', stats);
            return res.status(400).json({ message: 'Invalid stats data' });
        }

        // Validate required fields
        const requiredFields = ['totalSessions', 'totalBuyins', 'totalCashouts', 'biggestWin', 'biggestLoss'];
        const missingFields = requiredFields.filter(field => !(field in stats));
        if (missingFields.length > 0) {
            console.log('Missing required fields:', missingFields);
            return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
        }

        // Validate numeric values
        for (const field of requiredFields) {
            if (isNaN(stats[field])) {
                console.log(`Invalid numeric value for ${field}:`, stats[field]);
                return res.status(400).json({ message: `Invalid numeric value for ${field}` });
            }
        }

        // Find and update the player
        const player = await Player.findOneAndUpdate(
            { name: playerName },
            { 
                $set: {
                    stats: {
                        totalSessions: parseInt(stats.totalSessions),
                        totalBuyins: parseFloat(stats.totalBuyins),
                        totalCashouts: parseFloat(stats.totalCashouts),
                        netProfit: parseFloat(stats.totalCashouts) - parseFloat(stats.totalBuyins),
                        biggestWin: parseFloat(stats.biggestWin),
                        biggestLoss: parseFloat(stats.biggestLoss)
                    }
                }
            },
            { new: true }
        );

        if (!player) {
            console.log('Player not found:', playerName);
            return res.status(404).json({ message: 'Player not found' });
        }

        console.log('Successfully updated stats for player:', playerName);
        res.json(player);
    } catch (error) {
        console.error('Error updating player stats:', error);
        res.status(500).json({ 
            message: 'Error updating player stats',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 