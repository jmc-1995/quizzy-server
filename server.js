const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Quizzy server funcionando 🚀");
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
      currentQuestion: 0,
      scores: {}
    };
socket.on("joinRoom", ({ roomId, name }) => {
  const room = rooms[roomId];

socket.on("joinRoom", (data) => {
  console.log("JOIN recibido:", data);
});
  
  if (!room) {
    socket.emit("errorMessage", "Sala no existe");
    return;
  }

  socket.join(roomId);

  const player = {
    id: socket.id,
    name: name
  };

  room.players.push(player);
  room.scores[socket.id] = 0;

  console.log("Jugador unido:", name, "a sala", roomId);

  io.to(roomId).emit("playersUpdate", room.players);
});
});

server.listen(3000, () => {
  console.log("Servidor corriendo");
});
