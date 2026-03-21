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
    const roomId = data.roomId.trim();
    const name = data.name;

    const room = rooms[roomId];
    if (!room) return;

    socket.join(roomId);

    if (name !== "Pantalla") {
      room.players.push({ id: socket.id, name });
      room.scores[socket.id] = { name, points: 0 };
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
      const ranking = Object.values(room.scores)
        .sort((a, b) => b.points - a.points);

      io.to(roomId).emit("gameOver", ranking);
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

    // ❌ No aceptar fuera de tiempo
    if (now > room.endTime) return;

    const q = room.questions[room.currentQuestion];
    const tiempoRestante = Math.floor((room.endTime - now) / 1000);

    if (!room.scores[socket.id]) return;

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

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
