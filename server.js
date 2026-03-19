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

  socket.on("joinRoom", ({ roomId, name }) => {
    const room = rooms[roomId.trim()];
    if (!room) {
      socket.emit("errorMessage", "Sala no existe");
      return;
    }

    socket.join(roomId.trim());
    const player = { id: socket.id, name: name };
    room.players.push(player);
    room.scores[socket.id] = 0;

    console.log("Jugador unido:", name, "a sala", roomId);

    io.to(roomId.trim()).emit("playersUpdate", room.players);
  });

  socket.on("addQuestion", ({ roomId, question }) => {
    rooms[roomId.trim()].questions.push(question);
  });

  socket.on("startGame", (roomId) => {
    sendQuestion(roomId.trim());
  });

  socket.on("answer", ({ roomId, answer, time }) => {
    let room = rooms[roomId.trim()];
    let q = room.questions[room.currentQuestion];
    if (answer === q.correct) {
      room.scores[socket.id] += 1000 - time;
    }
  });

  function sendQuestion(roomId) {
    let room = rooms[roomId];
    let q = room.questions[room.currentQuestion];
    io.to(roomId).emit("newQuestion", q);

    setTimeout(() => {
      room.currentQuestion++;
      if (room.currentQuestion < room.questions.length) {
        sendQuestion(roomId);
      } else {
        io.to(roomId).emit("gameOver", room.scores);
      }
    }, 10000);
  }

}); // <--- FIN DEL io.on("connection")

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
