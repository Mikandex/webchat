// Import necessary modules
const express = require('express');
const { WebSocketServer } = require('ws');

// Create an Express app
const app = express();
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());

// In-memory storage for chat rooms
const chatRooms = {};

// Create a WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Function to handle WebSocket connections
wss.on('connection', (ws, request, roomId) => {
  if (!chatRooms[roomId]) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Chat room does not exist.' }));
    return ws.close();
  }

  // Add the new connection to the chat room
  chatRooms[roomId].clients.add(ws);

  // Notify the user of successful connection
  ws.send(JSON.stringify({ type: 'CONNECTED', roomId }));

  // Handle incoming messages
  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    // Handle incoming messages based on type
    switch (parsedMessage.type) {
      case 'MESSAGE':
        sendMessageToRoom(roomId, parsedMessage.content);
        break;
      case 'LEAVE':
        leaveChatRoom(roomId, ws);
        break;
      case 'CLOSE_CHAT':
        closeChatRoom(roomId);
        break;
      default:
        console.log('Unknown message type:', parsedMessage.type);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    leaveChatRoom(roomId, ws);
  });
});

// Function to send a message to all clients in a room
function sendMessageToRoom(roomId, content) {
  if (chatRooms[roomId]) {
    chatRooms[roomId].clients.forEach((client) => {
      client.send(JSON.stringify({ type: 'NEW_MESSAGE', content }));
    });
  }
}

// Function to remove a client from a chat room
function leaveChatRoom(roomId, ws) {
  if (chatRooms[roomId]) {
    chatRooms[roomId].clients.delete(ws);

    // Optionally notify other clients that someone left
    sendMessageToRoom(roomId, 'A user has left the chat.');
  }
}

// Function to close a chat room
function closeChatRoom(roomId) {
  if (chatRooms[roomId]) {
    // Notify all clients that the chat is closed
    chatRooms[roomId].clients.forEach((client) => {
      client.send(JSON.stringify({ type: 'CHAT_CLOSED' }));
      client.close();
    });

    // Remove the chat room from the memory
    delete chatRooms[roomId];
  }
}

// API endpoint to handle dispute creation
app.post('/dispute', (req, res) => {
  const { buyerId, sellerId, mediatorId } = req.body;

  // Generate a unique room ID
  const roomId = `room_${Date.now()}`;

  // Create a new chat room
  chatRooms[roomId] = { buyer: buyerId, seller: sellerId, mediator: mediatorId, clients: new Set() };

  // Respond with the room ID
  res.json({ success: true, roomId });
});

app.get('/chat/:roomId', (req, res) => {
    const { roomId } = req.params;
  
    if (!chatRooms[roomId]) {
      return res.status(404).json({ success: false, message: 'Chat room not found.' });
    }
  
    res.json({ success: true, messages: chatRooms[roomId].messages });
  });


app.post('/chat/send', (req, res) => {
    const { roomId, content, sender } = req.body;
  
    if (!chatRooms[roomId]) {
      return res.status(404).json({ success: false, message: 'Chat room not found.' });
    }
  
    // Send message to room
    sendMessageToRoom(roomId, content, sender);
  
    res.json({ success: true, message: 'Message sent.' });
  });
  
  // Upgrad
// Upgrade HTTP server to handle WebSocket connections
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/ws') {
    const roomId = new URLSearchParams(request.url.split('?')[1]).get('roomId');
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, roomId);
    });
  } else {
    socket.destroy();
  }
});
