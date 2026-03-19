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
      scores: {},
      answered: 0
    };

    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });

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

  socket.on("addQuestion", ({ roomId, question }) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.questions.push(question);

    // 🔥 CONFIRMACIÓN AL HOST
    socket.emit("questionAdded", room.questions.length);
  });

  socket.on("startGame", (roomId) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.currentQuestion = -1;
  });

  socket.on("nextQuestion", (roomId) => {
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    room.currentQuestion++;
    room.answered = 0;

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
    roomId = roomId.trim();
    const room = rooms[roomId];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (answer === q.correcta) {
      room.scores[socket.id].points += 1000 - (time * 50);
    }

    room.answered++;

    // 🔥 Cuando todos responden → mostrar ranking
    if (room.answered >= room.players.length) {
      const ranking = Object.values(room.scores)
        .sort((a, b) => b.points - a.points);

      io.to(roomId).emit("showRanking", ranking);
    }
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
