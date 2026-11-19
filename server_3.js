// OPEN WORLD. - Matching Server
// Run: npm install && npm start  (port 3001)
// Deploy: Railway / Render / Fly.io
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (req,res)=>res.json({ok:true, online: waiting.length, rooms: rooms.size}));
app.get('/', (req,res)=>res.send('OPEN WORLD. server is live'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

let waiting = []; // [{socketId, user:{name,country,language,interests,gender}}]
let rooms = new Map(); // roomId -> [socketId, socketId]
let reports = new Map(); // socketId -> count
let banned = new Set();

function findMatch(user){
  // Priority: same language -> same interest -> any
  let bestIdx = -1, bestScore = -1;
  waiting.forEach((w,i)=>{
    let score = 0;
    if(w.user.language === user.language) score += 10;
    if(w.user.country === user.country) score += 3;
    const common = w.user.interests.filter(x=>user.interests.includes(x)).length;
    score += common * 5;
    if(score > bestScore){ bestScore = score; bestIdx = i; }
  });
  return bestIdx;
}

function removeFromWaiting(socketId){
  waiting = waiting.filter(w=>w.socketId !== socketId);
}

function endRoom(roomId, reason='next'){
  const members = rooms.get(roomId);
  if(!members) return;
  members.forEach(id=>{ const s = io.sockets.sockets.get(id); if(s){ s.leave(roomId); s.data.roomId=null; } });
  rooms.delete(roomId);
}

io.on('connection', (socket)=>{
  console.log('connected', socket.id);
  socket.data.user = null; socket.data.roomId = null;

  socket.on('join', (user)=>{
    if(banned.has(socket.id)) return socket.emit('banned');
    socket.data.user = {...user, id: socket.id};
    socket.emit('joined', {id: socket.id, online: io.engine.clientsCount});
    io.emit('online', io.engine.clientsCount);
  });

  socket.on('find-match', ()=>{
    const user = socket.data.user; if(!user) return;
    if(socket.data.roomId) endRoom(socket.data.roomId);
    removeFromWaiting(socket.id);
    const idx = findMatch(user);
    if(idx === -1){ waiting.push({socketId: socket.id, user}); socket.emit('searching'); }
    else {
      const partner = waiting.splice(idx,1)[0];
      const roomId = uuidv4();
      rooms.set(roomId, [socket.id, partner.socketId]);
      const s1 = socket, s2 = io.sockets.sockets.get(partner.socketId);
      if(!s2){ waiting.push({socketId: socket.id, user}); return socket.emit('searching'); }
      s1.join(roomId); s2.join(roomId);
      s1.data.roomId = roomId; s2.data.roomId = roomId;
      // partner info (no personal data)
      s1.emit('matched', {roomId, partner: partner.user, initiator: true});
      s2.emit('matched', {roomId, partner: user, initiator: false});
      console.log('matched', roomId);
    }
  });

  socket.on('next', ()=>{
    const roomId = socket.data.roomId;
    if(roomId){
      const members = rooms.get(roomId) || [];
      members.forEach(id=>{ const s=io.sockets.sockets.get(id); if(s) s.emit('partner-left'); });
      endRoom(roomId);
    }
    socket.emit('searching');
    // re-queue both: partner also goes to searching via client
    setTimeout(()=> socket.emit('find-match-auto'), 300);
  });

  // WebRTC signaling - relay only, server never sees video
  socket.on('offer', (data)=> socket.to(data.roomId).emit('offer', data));
  socket.on('answer', (data)=> socket.to(data.roomId).emit('answer', data));
  socket.on('ice-candidate', (data)=> socket.to(data.roomId).emit('ice-candidate', data));

  socket.on('chat', (data)=>{
    if(!socket.data.roomId) return;
    // Basic safety: hide phone numbers / links
    let text = String(data.text||'').slice(0,500);
    text = text.replace(/\d{10,}/g,'[hidden]').replace(/(instagram|snap|telegram|whatsapp)/gi,'[hidden]');
    socket.to(socket.data.roomId).emit('chat', {from: socket.id, text, at: Date.now()});
  });

  socket.on('report', ()=>{
    const roomId = socket.data.roomId;
    if(roomId){
      const members = rooms.get(roomId)||[];
      const otherId = members.find(id=>id!==socket.id);
      if(otherId){
        const c = (reports.get(otherId)||0)+1;
        reports.set(otherId, c);
        const other = io.sockets.sockets.get(otherId);
        if(c>=3 && other){ other.emit('banned-temp'); banned.add(otherId); }
      }
      members.forEach(id=>{ const s=io.sockets.sockets.get(id); if(s) s.emit('partner-left'); });
      endRoom(roomId);
    }
    socket.emit('reported');
  });

  socket.on('disconnect', ()=>{
    removeFromWaiting(socket.id);
    const roomId = socket.data.roomId;
    if(roomId){
      socket.to(roomId).emit('partner-left');
      endRoom(roomId);
    }
    io.emit('online', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=> console.log(`OPEN WORLD server on ${PORT}`));
