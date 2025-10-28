import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, role }) => {
    socket.join(roomId);
    socket.data = { roomId, role };

    if (role === "broadcaster") {
      socket.to(roomId).emit("broadcaster-ready", { broadcasterId: socket.id });
    }

    if (role === "viewer") {
      const sockets = [...io.sockets.sockets.values()];
      const broadcaster = sockets.find(
        (s) => s.data?.roomId === roomId && s.data?.role === "broadcaster"
      );
      if (broadcaster) {
        socket.emit("broadcaster-ready", { broadcasterId: broadcaster.id });
      }
    }
  });

  socket.on("offer", ({ to, description }) => io.to(to).emit("offer", { from: socket.id, description }));
  socket.on("answer", ({ to, description }) => io.to(to).emit("answer", { from: socket.id, description }));
  socket.on("candidate", ({ to, candidate }) => io.to(to).emit("candidate", { from: socket.id, candidate }));

  socket.on("disconnect", () => {
    const { roomId, role } = socket.data || {};
    if (roomId && role === "broadcaster") socket.to(roomId).emit("broadcaster-disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor no ar em http://localhost:${PORT}`));
