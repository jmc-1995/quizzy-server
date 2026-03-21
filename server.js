const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Quizzy server funcionando ✅");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let rooms = {};

// 🔥 ARCHIVO JSON
function cargarSalas(){
  try{
    return JSON.parse(fs.readFileSync("salas.json"));
  }catch{
    return {};
  }
}

function guardarSalas(data){
  fs.writeFileSync("salas.json", JSON.stringify(data,null,2));
}

io.on("connection", (socket) => {

  // CREAR SALA
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

  // UNIRSE
  socket.on("joinRoom", (data) => {

    const roomId = data.roomId.trim();
    let name = (data.name || "").trim();

    const room = rooms[roomId];
    if (!room) return;

    if (!name) name = "Jugador_" + Math.floor(Math.random()*1000);

    socket.join(roomId);
    socket.data.name = name;

    if (name !== "Pantalla") {
      room.players[name] = { name };

      if (!room.scores[name]) {
        room.scores[name] = { name, points: 0 };
      }
    }

    io.to(roomId).emit("playersUpdate", Object.values(room.players));
    socket.emit("joinedRoom", roomId);
  });

  // AGREGAR PREGUNTA
  socket.on("addQuestion", (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    room.questions.push(data.question);
    socket.emit("questionAdded", room.questions.length);
  });

  // SIGUIENTE PREGUNTA
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

  // RESPUESTA
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

  // MOSTRAR RESULTADOS
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
  socket.on("saveRoom",(data)=>{

    const { roomId, nombre, password } = data;
    const room = rooms[roomId];
    if(!room) return;

    let db = cargarSalas();

    db[nombre] = {
      password,
      questions: room.questions
    };

    guardarSalas(db);

    socket.emit("roomSaved","✅ Sala guardada");
  });

  // 📂 CARGAR SALA
  socket.on("loadRoom",(data)=>{

    const { nombre, password } = data;
    let db = cargarSalas();

    const sala = db[nombre];

    if(!sala){
      socket.emit("errorLoad","❌ No existe");
      return;
    }

    if(sala.password !== password){
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

});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
