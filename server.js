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

    if (!name) {
      name = "Jugador_" + Math.floor(Math.random()*1000);
    }

    socket.data.name = name;

    // 🔥 LIMPIEZA TOTAL
    room.players = room.players.filter(p => p.id !== socket.id);

    if (name !== "Pantalla") {

      const player = {
        id: socket.id,
        name: name
      };

      room.players.push(player);

      // score por nombre
      if (!room.scores[name]) {
        room.scores[name] = { name, points: 0 };
      }
    }

    // 🔥 DEBUG CLAVE
    console.log("PLAYERS ACTUALES:", room.players);

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

    const name = socket.data.name;
    if (!name || !room.scores[name]) return;

    if (data.answer === q.correcta) {
      room.scores[name].points += 5 + (tiempoRestante * 2);
    } else {
      room.scores[name].points += 2;
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
      .sort((a, b) => b.points - a.points);

    io.to(roomId).emit("showRanking", ranking);
  }

});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
