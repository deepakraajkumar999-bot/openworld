// OPEN WORLD. - FULL SERVER: Matching + Coins + Premium + Admin
// Run: npm install && npm start
const express=require('express'); const http=require('http'); const {Server}=require('socket.io'); const cors=require('cors'); const {v4:uuidv4}=require('uuid');
const app=express(); app.use(cors()); app.use(express.json());
let waiting=[], rooms=new Map(), reports=new Map(), banned=new Set(), users=new Map(), adminLog=[];
let stats={totalMatches:0,totalChats:0,totalReports:0,coinsSold:0};
app.get('/health',(req,res)=>res.json({ok:true,online:waiting.length,rooms:rooms.size,...stats}));
app.get('/admin-data',(req,res)=>res.json({online:waiting.length,rooms:[...rooms.keys()].length,reports:[...reports.entries()],users:[...users.values()],log:adminLog.slice(-50),stats}));
app.post('/admin/ban',(req,res)=>{ banned.add(req.body.socketId); adminLog.push(`Banned ${req.body.socketId}`); res.json({ok:true}); });
app.post('/admin/unban',(req,res)=>{ banned.delete(req.body.socketId); res.json({ok:true}); });
app.get('/',(req,res)=>res.send('OPEN WORLD. server live'));
const server=http.createServer(app); const io=new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});
function findMatch(user){ let bi=-1,bs=-1; waiting.forEach((w,i)=>{ let s=0; if(w.user.language===user.language)s+=10; if(w.user.country===user.country)s+=3; s+=w.user.interests.filter(x=>user.interests.includes(x)).length*5; if(user.premium) s+=20; if(s>bs){bs=s;bi=i;} }); return bi; }
function removeWaiting(id){ waiting=waiting.filter(w=>w.socketId!==id); }
function endRoom(id){ const m=rooms.get(id); if(!m)return; m.forEach(x=>{const s=io.sockets.sockets.get(x); if(s){s.leave(id); s.data.roomId=null;}}); rooms.delete(id); }
io.on('connection',socket=>{
  socket.on('join',user=>{
    if(banned.has(socket.id)) return socket.emit('banned');
    socket.data.user={...user,id:socket.id,coins:user.coins||120,premium:!!user.premium};
    users.set(socket.id,socket.data.user); socket.emit('joined',{id:socket.id,coins:socket.data.user.coins}); io.emit('online',io.engine.clientsCount);
  });
  socket.on('find-match',()=>{
    const user=socket.data.user; if(!user)return; if(socket.data.roomId) endRoom(socket.data.roomId); removeWaiting(socket.id);
    // Premium: pick country filter costs 10 coins
    if(user.premiumFilter && user.coins>=10){ user.coins-=10; socket.emit('coins',user.coins); }
    const idx=findMatch(user);
    if(idx===-1){ waiting.push({socketId:socket.id,user}); socket.emit('searching'); }
    else{ const p=waiting.splice(idx,1)[0]; const roomId=uuidv4(); rooms.set(roomId,[socket.id,p.socketId]); const s1=socket,s2=io.sockets.sockets.get(p.socketId); if(!s2){waiting.push({socketId:socket.id,user}); return socket.emit('searching');} s1.join(roomId); s2.join(roomId); s1.data.roomId=roomId; s2.data.roomId=roomId; stats.totalMatches++; s1.emit('matched',{roomId,partner:p.user,initiator:true}); s2.emit('matched',{roomId,partner:user,initiator:false}); }
  });
  socket.on('next',()=>{ const r=socket.data.roomId; if(r){ rooms.get(r)?.forEach(id=>{const s=io.sockets.sockets.get(id); if(s)s.emit('partner-left');}); endRoom(r);} socket.emit('searching'); setTimeout(()=>socket.emit('find-match-auto'),300); });
  socket.on('offer',d=>socket.to(d.roomId).emit('offer',d));
  socket.on('answer',d=>socket.to(d.roomId).emit('answer',d));
  socket.on('ice-candidate',d=>socket.to(d.roomId).emit('ice-candidate',d));
  socket.on('chat',d=>{ if(!socket.data.roomId)return; let t=String(d.text||'').slice(0,500).replace(/\d{10,}/g,'[hidden]').replace(/(instagram|snap|telegram|whatsapp)/gi,'[hidden]'); stats.totalChats++; socket.to(socket.data.roomId).emit('chat',{from:socket.id,text:t,at:Date.now()}); });
  socket.on('buy-coins',pack=>{ const u=socket.data.user; if(!u)return; const amt=pack==='100'?100:pack==='500'?550:1200; u.coins+=amt; stats.coinsSold+=amt; socket.emit('coins',u.coins); socket.emit('coins-bought',amt); });
  socket.on('buy-premium',()=>{ const u=socket.data.user; if(!u)return; if(u.coins>=200){ u.coins-=200; u.premium=true; socket.emit('coins',u.coins); socket.emit('premium-on'); } else socket.emit('need-coins'); });
  socket.on('report',()=>{ const r=socket.data.roomId; stats.totalReports++; adminLog.push(`${new Date().toLocaleTimeString()} Report in ${r}`); if(r){ const mem=rooms.get(r)||[]; const other=mem.find(id=>id!==socket.id); if(other){ const c=(reports.get(other)||0)+1; reports.set(other,c); if(c>=3){ banned.add(other); io.sockets.sockets.get(other)?.emit('banned-temp'); } } mem.forEach(id=>{const s=io.sockets.sockets.get(id); if(s)s.emit('partner-left');}); endRoom(r);} socket.emit('reported'); });
  socket.on('disconnect',()=>{ removeWaiting(socket.id); const r=socket.data.roomId; if(r){ socket.to(r).emit('partner-left'); endRoom(r);} users.delete(socket.id); io.emit('online',io.engine.clientsCount); });
});
const PORT=process.env.PORT||3001; server.listen(PORT,()=>console.log(`OPEN WORLD on ${PORT}`));
