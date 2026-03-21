const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Ruta base
app.get("/", (req, res) => {
  res.send("Quizzy server funcionando ✅");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
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

  // Unirse a sala
  socket.on("joinRoom", (data) => {

    if (!data || !data.roomId) return;

    const roomId = data.roomId.trim();
    const name = data.name || "Anon";

    const room = rooms[roomId];

    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId);

    // NO agregar pantalla
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
    socket.emit("joinedRoom", roomId);
  });

  // Agregar pregunta
  socket.on("addQuestion", (data) => {

    if (!data || !data.roomId || !data.question) return;

    const room = rooms[data.roomId.trim()];
    if (!room) return;

    room.questions.push(data.question);

    socket.emit("questionAdded", room.questions.length);
  });

  // Siguiente pregunta
  socket.on("nextQuestion", (roomId) => {

    if (!roomId) return;

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

    // Mezclar opciones
    const opciones = [...q.opciones].sort(() => Math.random() - 0.5);

    io.to(roomId).emit("newQuestion", {
      pregunta: q.pregunta,
      opciones: opciones,
      correcta: q.correcta,
      tiempo: q.tiempo
    });
  });

  // Respuesta
  socket.on("answer", (data) => {

    if (!data || !data.roomId) return;

    const room = rooms[data.roomId.trim()];
    if (!room) return;

    const q = room.questions[room.currentQuestion];

    if (q && data.answer === q.correcta) {
      const puntos = Math.max(0, 1000 - (data.time * 50));

      room.scores[socket.id].points += puntos;
    }
  });

  // Mostrar ranking
  socket.on("showResults", (roomId) => {

    if (!roomId) return;

    const room = rooms[roomId.trim()];
    if (!room) return;

    const ranking = Object.values(room.scores)
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
