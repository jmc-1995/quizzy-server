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

// 🔥 MONGO (NO BLOQUEANTE)
const uri = "mongodb+srv://quizzy:Jhon1995@quizzy.ll9ykix.mongodb.net/quizzy?retryWrites=true&w=majority";

let db = null;

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000
});

client.connect()
  .then(() => {
    db = client.db("quizzy");
    console.log("🔥 Mongo conectado");
  })
  .catch(err => {
    console.log("⚠️ Mongo no responde:", err.message);
  });

// 🎮 MEMORIA
let rooms = {};

io.on("connection", (socket) => {

  // 🎮 CREAR SALA
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

  // 👤 UNIRSE
  socket.on("joinRoom", (data) => {

    const room = rooms[data.roomId];
    if (!room) return;

    let name = (data.name || "").trim();
    if (!name) name = "Jugador_" + Math.floor(Math.random()*1000);

    socket.join(data.roomId);
    socket.data.name = name;

    if (name !== "Pantalla") {
      room.players[name] = { name };

      if (!room.scores[name]) {
        room.scores[name] = { name, points: 0 };
      }
    }

    io.to(data.roomId).emit("playersUpdate", Object.values(room.players));
    socket.emit("joinedRoom", data.roomId);
  });

  // ➕ AGREGAR PREGUNTA
  socket.on("addQuestion", (data) => {

    const room = rooms[data.roomId];
    if (!room) return;

    room.questions.push(data.question);

    socket.emit("questionAdded", room.questions.length);
  });

  // ➡️ SIGUIENTE PREGUNTA
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

  // 🎯 RESPUESTA
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

  // 📊 MOSTRAR RESULTADOS
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

  // 💾 GUARDAR SALA
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

    if(!data.nombre || !data.password){
      socket.emit("roomSaved","❌ Datos incompletos");
      return;
    }

    try{
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

    }catch(e){
      socket.emit("roomSaved","❌ Error al guardar");
    }
  });

  // 📂 CARGAR SALA
  socket.on("loadRoom", async (data)=>{

    if(!db){
      socket.emit("errorLoad","❌ Mongo no conectado");
      return;
    }

    try{

      const sala = await db.collection("salas").findOne({ nombre: data.nombre });

      if(!sala){
        socket.emit("errorLoad","❌ Sala no existe");
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

    }catch(e){
      socket.emit("errorLoad","❌ Error al cargar");
    }
  });

  // 📋 LISTAR SALAS
  socket.on("getRooms", async ()=>{

    if(!db){
      socket.emit("roomsList",[]);
      return;
    }

    try{
      const salas = await db.collection("salas")
        .find({}, { projection: { nombre: 1, _id: 0 } })
        .toArray();

      socket.emit("roomsList", salas);

    }catch(e){
      socket.emit("roomsList",[]);
    }
  });

});

// 🚀 ARRANQUE INMEDIATO
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Servidor corriendo");
});
