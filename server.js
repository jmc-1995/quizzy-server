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

  socket.on("joinRoom", (data) => {
    const roomId = data.roomId.trim();
    const name = data.name;

    const room = rooms[roomId];

    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId);

    // 🔥 EXCLUIR PANTALLA
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

    io.to(roomId).emit("playersUpdate", room.players);

    // 🔥 CONFIRMAR CONEXIÓN
    socket.emit("joinedRoom", roomId);
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
