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

  // Crear sala
  socket.on("createRoom", () => {
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[roomId] = {
      players: [],
      questions: [],
      currentQuestion: -1,
      scores: {}
    };

    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });

  // Unirse
  socket.on("joinRoom", ({ roomId, name }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    socket.join(roomId);

    room.players.push({ id: socket.id, name });

    room.scores[socket.id] = {
      name,
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

    room.currentQuestion = -1;
  });

  // 🔥 Siguiente pregunta (control manual)
  socket.on("nextQuestion", (roomId) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.currentQuestion++;

    if (room.currentQuestion >= room.questions.length) {
      const ranking = Object.values(room.scores)
        .sort((a, b) => b.points - a.points);

      io.to(roomId).emit("gameOver", ranking);
      return;
    }

    const q = room.questions[room.currentQuestion];

    // 🔥 Mezclar opciones
    const opciones = [...q.opciones].sort(() => Math.random() - 0.5);

    io.to(roomId).emit("newQuestion", {
      pregunta: q.pregunta,
      opciones: opciones,
      correcta: q.correcta,
      tiempo: q.tiempo
    });
  });

  // Responder
  socket.on("answer", ({ roomId, answer, time }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (answer === q.correcta) {
      room.scores[socket.id].points += 1000 - (time * 50);
    }
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
