const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Quizzy server funcionando ✅");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// 🔥 MONGO (SEGURO)
const uri = "mongodb+srv://quizzy:Jhon1995@quizzy.ll9ykix.mongodb.net/quizzy?retryWrites=true&w=majority";

let db = null;

// 🔥 CONEXIÓN SIN CRASH
async function conectarMongo(){
  try{
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db("quizzy");
    console.log("🔥 Mongo conectado");
  }catch(e){
    console.log("⚠️ Mongo NO conectado (pero servidor sigue funcionando)");
  }
}
conectarMongo();

let rooms = {};

io.on("connection", (socket) => {

  socket.on("createRoom", () => {

    const roomId = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[roomId] = {
      players: {},
      questions: [],
      currentQuestion: -1,
      scores: {},
      active: false
    };

    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });

  socket.on("joinRoom", (data) => {

    const room = rooms[data.roomId];
    if (!room) return;

    let name = data.name || "Jugador_" + Math.floor(Math.random()*1000);

    socket.join(data.roomId);
    socket.data.name = name;

    if(name !== "Pantalla"){
      room.players[name] = { name };

      if (!room.scores[name]) {
        room.scores[name] = { name, points: 0 };
      }
    }

    io.to(data.roomId).emit("playersUpdate", Object.values(room.players));
    socket.emit("joinedRoom", data.roomId);
  });

  socket.on("addQuestion", (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    room.questions.push(data.question);
    socket.emit("questionAdded", room.questions.length);
  });

  socket.on("nextQuestion", (roomId) => {

    const room = rooms[roomId];
    if (!room) return;

    room.currentQuestion++;

    if (room.currentQuestion >= room.questions.length) {
      enviarRanking(roomId);
      return;
    }

    const q = room.questions[room.currentQuestion];

    room.active = true;
    room.endTime = Date.now() + q.tiempo;

    const opciones = [...q.opciones].sort(() => Math.random() - 0.5);

    io.to(roomId).emit("newQuestion", {
      pregunta: q.pregunta,
      opciones,
      correcta: q.correcta,
      tiempo: q.tiempo
    });
  });

  socket.on("answer", (data) => {

    const room = rooms[data.roomId];
    if (!room || !room.active) return;

    const now = Date.now();
    if (now > room.endTime) return;

    const q = room.questions[room.currentQuestion];
    const tiempoRestante = Math.floor((room.endTime - now) / 1000);

    const name = socket.data.name;

    if (!room.scores[name]) return;

    if (data.answer === q.correcta) {
      room.scores[name].points += 5 + (tiempoRestante * 2);
    } else {
      room.scores[name].points += 2;
    }
  });

  socket.on("showResults", (roomId) => {
    enviarRanking(roomId);
  });

  function enviarRanking(roomId){
    const room = rooms[roomId];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  }

  // 💾 GUARDAR (SOLO SI MONGO EXISTE)
  socket.on("saveRoom", async (data)=>{

    if(!db){
      socket.emit("roomSaved","❌ Mongo no conectado");
      return;
    }

    const room = rooms[data.roomId];

    if(!room){
      socket.emit("roomSaved","❌ Sala no existe");
      return;
    }

    await db.collection("salas").updateOne(
      { nombre: data.nombre },
      {
        $set:{
          nombre: data.nombre,
          password: data.password,
          questions: room.questions
        }
      },
      { upsert:true }
    );

    socket.emit("roomSaved","💾 Sala guardada");
  });

  socket.on("loadRoom", async (data)=>{

    if(!db){
      socket.emit("errorLoad","❌ Mongo no conectado");
      return;
    }

    const sala = await db.collection("salas").findOne({ nombre: data.nombre });

    if(!sala){
      socket.emit("errorLoad","❌ No existe");
      return;
    }

    if(sala.password !== data.password){
      socket.emit("errorLoad","❌ Contraseña incorrecta");
      return;
    }

    const roomId = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[roomId] = {
      players: {},
      questions: sala.questions,
      currentQuestion: -1,
      scores: {},
      active: false
    };

    socket.join(roomId);
    socket.emit("roomLoaded", roomId);
  });

  socket.on("getRooms", async ()=>{

    if(!db){
      socket.emit("roomsList",[]);
      return;
    }

    const salas = await db.collection("salas")
      .find({}, { projection: { nombre: 1, _id: 0 } })
      .toArray();

    socket.emit("roomsList", salas);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log("🚀 Servidor corriendo"));
