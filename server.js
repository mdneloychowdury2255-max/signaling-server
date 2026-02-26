const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = {};

function send(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

wss.on('connection', function connection(ws) {
  let myId = null;

  ws.on('message', function incoming(message) {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'register':
          myId = msg.userId;
          clients[myId] = ws;
          send(ws, { type: 'registered', userId: myId });
          console.log('Registered', myId);
          break;

        case 'call':
          const calleeWs = clients[msg.to];
          if (calleeWs) send(calleeWs, { type: 'incoming_call', from: msg.from });
          else send(ws, { type: 'unavailable', to: msg.to });
          break;

        case 'offer':
        case 'answer':
        case 'ice':
        case 'hangup':
          const targetWs = clients[msg.to];
          if (targetWs) send(targetWs, msg);
          else send(ws, { type: 'unavailable', to: msg.to });
          break;

        default:
          send(ws, { type: 'error', message: 'unknown_type' });
      }
    } catch (e) {
      console.error('msg parse error', e);
    }
  });

  ws.on('close', function () {
    if (myId && clients[myId]) {
      delete clients[myId];
      console.log('Disconnected', myId);
    }
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling server running on :${PORT}`));
