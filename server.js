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
  socket.on("joinRoom", (data) => {
    const roomId = data.roomId.trim();
    const name = data.name;

    const room = rooms[roomId];

    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId);

    room.players.push({
      id: socket.id,
      name: name
    });

    room.scores[socket.id] = {
      name: name,
      points: 0
    };

    io.to(roomId).emit("playersUpdate", room.players);
  });

  // Agregar pregunta
  socket.on("addQuestion", (data) => {
    const room = rooms[data.roomId.trim()];
    if (!room) return;

    room.questions.push(data.question);

    socket.emit("questionAdded", room.questions.length);
  });

  // Iniciar juego
  socket.on("startGame", (roomId) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    room.currentQuestion = -1;
  });

  // Siguiente pregunta
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

    const opciones = q.opciones.sort(() => Math.random() - 0.5);

    io.to(roomId).emit("newQuestion", {
      pregunta: q.pregunta,
      opciones: opciones,
      correcta: q.correcta,
      tiempo: q.tiempo
    });
  });

  // Responder
  socket.on("answer", (data) => {
    const room = rooms[data.roomId.trim()];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (q && data.answer === q.correcta) {
      room.scores[socket.id].points += 1000 - (data.time * 50);
    }
  });

  // Mostrar resultados
  socket.on("showResults", (roomId) => {
    const room = rooms[roomId.trim()];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  });

  // Desconexión (evita errores)
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
