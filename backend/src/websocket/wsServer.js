const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws'
    });

    this.clients = new Map(); // userId -> WebSocket connection

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    console.log('✅ WebSocket server initialized at /ws');
  }

  handleConnection(ws, req) {
    console.log('📡 New WebSocket connection attempt');

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'No authentication token provided');
      return;
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      // Store connection
      this.clients.set(userId, ws);
      console.log(`✅ User ${userId} connected via WebSocket`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established',
        userId
      }));

      // Handle incoming messages
      ws.on('message', (data) => this.handleMessage(userId, data));

      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(userId);
        console.log(`❌ User ${userId} disconnected from WebSocket`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        this.clients.delete(userId);
      });

    } catch (error) {
      console.error('WebSocket authentication failed:', error.message);
      ws.close(1008, 'Invalid authentication token');
    }
  }

  handleMessage(userId, data) {
    try {
      const message = JSON.parse(data);
      console.log(`📨 Message from ${userId}:`, message);

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendToUser(userId, { type: 'pong' });
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Send message to specific user
  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Broadcast to all connected clients
  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Notify user about specific events
  notifyRecordingComplete(userId, recording) {
    this.sendToUser(userId, {
      type: 'recording_complete',
      data: recording
    });
  }

  notifyJobComplete(userId, job) {
    this.sendToUser(userId, {
      type: 'job_complete',
      data: job
    });
  }

  notifyCreditsUpdated(userId, newBalance) {
    this.sendToUser(userId, {
      type: 'credits_updated',
      balance: newBalance
    });
  }

  notifyNewRecording(userId, recording) {
    this.sendToUser(userId, {
      type: 'new_recording',
      data: recording
    });
  }
}

module.exports = WebSocketServer;
