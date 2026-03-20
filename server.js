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

  console.log("Cliente conectado:", socket.id);

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

  socket.on("joinRoom", ({ roomId, name }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId);

    room.players.push({ id: socket.id, name });

    room.scores[socket.id] = {
      name,
      points: 0
    };

    // 🔥 IMPORTANTE: enviar jugadores
    io.to(roomId).emit("playersUpdate", room.players);
  });

  socket.on("addQuestion", ({ roomId, question }) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    room.questions.push(question);
    socket.emit("questionAdded", room.questions.length);
  });

  socket.on("startGame", (roomId) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    room.currentQuestion = -1;
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
    const opciones = [...q.opciones].sort(() => Math.random() - 0.5);

    io.to(roomId).emit("newQuestion", {
      pregunta: q.pregunta,
      opciones,
      correcta: q.correcta,
      tiempo: q.tiempo
    });
  });

  socket.on("answer", ({ roomId, answer, time }) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (answer === q.correcta) {
      room.scores[socket.id].points += 1000 - (time * 50);
    }
  });

  socket.on("showResults", (roomId) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  });

});
