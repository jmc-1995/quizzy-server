const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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

io.on("connection", (socket) => {

  socket.on("createRoom", () => {
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[roomId] = {
      players: [],
      questions: [],
      currentQuestion: -1,
      scores: {},
      active: false
    };

    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });

  socket.on("joinRoom", (data) => {

    if (!data || !data.roomId) return;

    const roomId = data.roomId.trim();
    let name = (data.name || "").trim();

    const room = rooms[roomId];
    if (!room) return;

    socket.join(roomId);

    // 🔥 Nombre por defecto si viene vacío
    if (!name) {
      name = "Jugador_" + Math.floor(Math.random()*1000);
    }

    // 🔥 GUARDAR EN EL SOCKET (CLAVE)
    socket.data.name = name;
    socket.data.roomId = roomId;

    // 🔥 Evitar duplicados
    room.players = room.players.filter(p => p.id !== socket.id);

    if (name !== "Pantalla") {

      room.players.push({
        id: socket.id,
        name: name
      });

      room.scores[socket.id] = {
        name: name,
        points: 0
      };
    }

    socket.emit("joinedRoom", roomId);
    io.to(roomId).emit("playersUpdate", room.players);
  });

  socket.on("addQuestion", (data) => {
    const room = rooms[data.roomId.trim()];
    if (!room) return;

    room.questions.push(data.question);
    socket.emit("questionAdded", room.questions.length);
  });

  socket.on("nextQuestion", (roomId) => {
    const room = rooms[roomId.trim()];
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
    const room = rooms[data.roomId.trim()];
    if (!room || !room.active) return;

    const now = Date.now();
    if (now > room.endTime) return;

    const q = room.questions[room.currentQuestion];
    const tiempoRestante = Math.floor((room.endTime - now) / 1000);

    // 🔥 USAR nombre del socket SIEMPRE
    const name = socket.data.name || "Jugador";

    if (!room.scores[socket.id]) {
      room.scores[socket.id] = { name, points: 0 };
    }

    if (data.answer === q.correcta) {
      room.scores[socket.id].points += 5 + (tiempoRestante * 2);
    } else {
      room.scores[socket.id].points += 2;
    }
  });

  socket.on("showResults", (roomId) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    room.active = false;
    enviarRanking(roomId);
  });

  function enviarRanking(roomId){
    const room = rooms[roomId];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .map(p => ({
        name: p.name || "Jugador",
        points: p.points
      }))
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  }

});
const PORT = process.env.PORT || 3000;
server.listen(PORT);
