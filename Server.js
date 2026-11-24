const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
app.use(cors());
app.get('/', (req,res)=>res.send('OPEN WORLD. server is live'));
const server = http.createServer(app);
const io = new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});
let users={};
let waiting=null;
io.on('connection',(socket)=>{
  console.log('connected',socket.id);
  socket.on('join',(data)=>{
    users[socket.id]={...data,socketId:socket.id};
    io.emit('online',Object.keys(users).length);
    console.log('online',Object.keys(users).length);
  });
  socket.on('find-match',()=>{
    if(waiting && waiting!==socket.id && users[waiting]){
      const roomId='room_'+Date.now();
      const other=users[waiting];
      const me=users[socket.id];
      socket.join(roomId);
      io.sockets.sockets.get(waiting)?.join(roomId);
      io.to(waiting).emit('matched',{roomId,partner:me,initiator:true});
      socket.emit('matched',{roomId,partner:other,initiator:false});
      waiting=null;
    } else {
      waiting=socket.id;
      socket.emit('searching');
    }
  });
  socket.on('next',()=>{waiting=null;});
  socket.on('offer',(d)=>{socket.to(d.roomId).emit('offer',d);});
  socket.on('answer',(d)=>{socket.to(d.roomId).emit('answer',d);});
  socket.on('ice-candidate',(d)=>{socket.to(d.roomId).emit('ice-candidate',d);});
  socket.on('chat',(d)=>{
    const rooms=[...socket.rooms].filter(r=>r!==socket.id);
    if(rooms[0]) socket.to(rooms[0]).emit('chat',d);
  });
  socket.on('report',()=>{socket.emit('reported');});
  socket.on('disconnect',()=>{
    delete users[socket.id];
    if(waiting===socket.id) waiting=null;
    io.emit('online',Object.keys(users).length);
  });
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Live on '+PORT));
