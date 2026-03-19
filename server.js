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

  // 🔹 Crear sala
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

    console.log("Sala creada:", roomId);

    socket.emit("roomCreated", roomId);
  });

  // 🔹 Unirse a sala
  socket.on("joinRoom", ({ roomId, name }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];

    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId);

    const player = { id: socket.id, name: name };
    room.players.push(player);

    // 🔥 Guardar nombre + puntos
    room.scores[socket.id] = {
      name: name,
      points: 0
    };

    console.log("Jugador unido:", name, "a sala", roomId);

    io.to(roomId).emit("playersUpdate", room.players);
  });

  // 🔹 Agregar preguntas
  socket.on("addQuestion", ({ roomId, question }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.questions.push(question);

    console.log("Pregunta agregada. Total:", room.questions.length);
  });

  // 🔹 Iniciar juego
  socket.on("startGame", (roomId) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    // 🔥 RESET
    room.currentQuestion = 0;

    console.log("Juego iniciado en sala", roomId);

    sendQuestion(roomId);
  });

  // 🔹 Respuestas
  socket.on("answer", ({ roomId, answer, time }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (q && answer === q.correcta) {
      room.scores[socket.id].points += 1000 - time;
    }
  });

  // 🔹 Enviar preguntas
  function sendQuestion(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (!q) return;

    console.log("Enviando pregunta:", q.pregunta);

    io.to(roomId).emit("newQuestion", q);

    setTimeout(() => {
      room.currentQuestion++;

      if (room.currentQuestion < room.questions.length) {
        sendQuestion(roomId);
      } else {
        endGame(roomId);
      }
    }, 10000); // 10 segundos por pregunta
  }

  // 🔹 Final del juego
  function endGame(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    console.log("Juego terminado:", ranking);

    io.to(roomId).emit("gameOver", ranking);
  }

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
