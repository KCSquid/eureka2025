const express = require('express');
const http = require('http');
const cors = require('cors');
const { Chess } = require('chess.js');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Create a WebSocket server
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Store active games
const games = new Map();

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinGame', (gameId) => {
    socket.join(gameId);
    console.log(`User ${socket.id} joined game: ${gameId}`);

    // Debugging: List all clients in the room
    const clients = io.sockets.adapter.rooms.get(gameId);
    console.log(`Clients in room ${gameId}:`, clients ? Array.from(clients) : []);

    // Notify all clients in the game room about the updated player count
    if (games.has(gameId)) {
      const game = games.get(gameId);
      io.to(gameId).emit('updatePlayers', { playersConnected: game.players });
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

// Create a new game or join an existing one
app.post('/api/joinGame', (req, res) => {
  const { gameId } = req.body;
  
  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }
  
  if (!games.has(gameId)) {
    // Create a new game
    const chess = new Chess();
    games.set(gameId, {
      chess,
      fen: chess.fen(),
      players: 1,
      lastActive: Date.now()
    });

    console.log(`Game created: ${gameId}, players: 1`);

    // Notify clients in the game room
    io.to(gameId).emit('updatePlayers', { playersConnected: 1 });
    
    return res.json({ 
      status: 'waiting', 
      fen: chess.fen(),
      message: 'Waiting for opponent',
      playersConnected: 1
    });
  } else {
    // Join existing game
    const game = games.get(gameId);
    
    if (game.players < 2) {
      game.players = 2;
      game.lastActive = Date.now();

      console.log(`Player joined game: ${gameId}, players: 2`);

      // Notify clients in the game room
      io.to(gameId).emit('updatePlayers', { playersConnected: 2 });
      
      return res.json({ 
        status: 'ready', 
        fen: game.fen,
        message: 'Game is ready',
        playersConnected: 2
      });
    } else {
      // Game is full
      console.log(`Attempt to join full game: ${gameId}`);
      return res.status(400).json({ 
        error: 'Game is full', 
        message: 'This game already has two players'
      });
    }
  }
});

// Get game status
app.get('/api/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = games.get(gameId);
  
  res.json({
    fen: game.fen,
    playersConnected: game.players,
    status: game.players === 2 ? 'ready' : 'waiting',
    history: game.chess.history(),
    turn: game.chess.turn() === 'w' ? 'white' : 'black',
    isCheck: game.chess.isCheck(),
    isCheckmate: game.chess.isCheckmate(),
    isDraw: game.chess.isDraw(),
    isGameOver: game.chess.isGameOver()
  });
});

// Make a move
app.post('/api/move', (req, res) => {
  const { gameId, from, to, promotion = 'q' } = req.body;
  
  if (!gameId || !from || !to) {
    return res.status(400).json({ error: 'GameId, from, and to are required' });
  }
  
  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = games.get(gameId);
  
  if (game.players < 2) {
    return res.status(400).json({ error: 'Waiting for opponent' });
  }
  
  try {
    const moveResult = game.chess.move({ from, to, promotion });
    
    if (moveResult) {
      game.fen = game.chess.fen();
      game.lastActive = Date.now();
      
      res.json({
        success: true,
        fen: game.fen,
        history: game.chess.history(),
        turn: game.chess.turn() === 'w' ? 'white' : 'black',
        isCheck: game.chess.isCheck(),
        isCheckmate: game.chess.isCheckmate(),
        isDraw: game.chess.isDraw(),
        isGameOver: game.chess.isGameOver()
      });
    } else {
      res.status(400).json({ error: 'Invalid move' });
    }
  } catch (e) {
    res.status(400).json({ error: 'Invalid move', details: e.message });
  }
});

// Reset game
app.post('/api/reset', (req, res) => {
  const { gameId } = req.body;
  
  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }
  
  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = games.get(gameId);
  game.chess.reset();
  game.fen = game.chess.fen();
  game.lastActive = Date.now();
  
  res.json({
    success: true,
    fen: game.fen,
    history: game.chess.history(),
    turn: game.chess.turn() === 'w' ? 'white' : 'black'
  });
});

// Undo move
app.post('/api/undo', (req, res) => {
  const { gameId } = req.body;
  
  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }
  
  if (!games.has(gameId)) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const game = games.get(gameId);
  const undoneMove = game.chess.undo();
  
  if (undoneMove) {
    game.fen = game.chess.fen();
    game.lastActive = Date.now();
    
    res.json({
      success: true,
      fen: game.fen,
      history: game.chess.history(),
      turn: game.chess.turn() === 'w' ? 'white' : 'black'
    });
  } else {
    res.status(400).json({ error: 'No move to undo' });
  }
});

// Clean up inactive games - run every hour
setInterval(() => {
  const now = Date.now();
  for (const [gameId, game] of games.entries()) {
    // Remove games inactive for more than 1 hour
    if (now - game.lastActive > 60 * 60 * 1000) {
      games.delete(gameId);
    }
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});