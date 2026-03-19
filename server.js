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

    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });
});

server.listen(3000, () => {
  console.log("Servidor corriendo");
});
