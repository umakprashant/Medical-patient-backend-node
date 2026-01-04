const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const chatRoutes = require('./routes/chat.routes');
const doctorRoutes = require('./routes/doctor.routes');
const chatSocket = require('./socket/chat.socket');

const app = express();
const httpServer = createServer(app);

// Allow multiple origins for CORS
const allowedOrigins = [
  'http://localhost:4200',
  'https://695aab0987f16e5c280591bb--curious-beignet-26cd5f.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/doctor', doctorRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  chatSocket(io, socket);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

module.exports = { app, httpServer };
