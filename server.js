const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let rooms = {};

io.on("connection", (socket) => {

  console.log("Usuario conectado:", socket.id);

  // Crear sala
  socket.on("createRoom", (hostName) => {
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[roomId] = {
      host: socket.id,
      players: [],
      questions: [],
      currentQuestion: 0,
      scores: {}
    };

    socket.join(roomId);

    socket.emit("roomCreated", roomId);
  });

  // Unirse a sala
  socket.on("joinRoom", ({ roomId, name }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];

    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId);

    const player = { id: socket.id, name };
    room.players.push(player);

    room.scores[socket.id] = {
      name: name,
      points: 0
    };

    io.to(roomId).emit("playersUpdate", room.players);
  });

  // Agregar pregunta
  socket.on("addQuestion", ({ roomId, question }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.questions.push(question);
  });

  // Iniciar juego
  socket.on("startGame", (roomId) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.currentQuestion = 0;
    sendQuestion(roomId);
  });

  // Responder
  socket.on("answer", ({ roomId, answer, time }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (q && answer === q.correcta) {
      room.scores[socket.id].points += 1000 - (time * 50);
    }
  });

  function sendQuestion(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const q = room.questions[room.currentQuestion];
    if (!q) return;

    io.to(roomId).emit("newQuestion", q);

    const tiempo = q.tiempo || 10000;

    setTimeout(() => {
      room.currentQuestion++;

      if (room.currentQuestion < room.questions.length) {
        sendQuestion(roomId);
      } else {
        endGame(roomId);
      }
    }, tiempo);
  }

  function endGame(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("gameOver", ranking);
  }

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
