// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// serve arquivos HTML e JS da pasta public/
app.use(express.static("public"));

// Mapa de conexões: roomId -> { broadcasterId, viewers[] }
io.on("connection", (socket) => {
  console.log(`🟢 Novo cliente conectado: ${socket.id}`);

  socket.on("join", ({ roomId, role }) => {
    socket.join(roomId);
    socket.data = { roomId, role };
    console.log(`👤 ${role} entrou na sala ${roomId}`);

    // Se for transmissor, avisa todos os viewers da sala
    if (role === "broadcaster") {
      socket.to(roomId).emit("broadcaster-ready", { broadcasterId: socket.id });
      console.log(`📡 Transmissor pronto na sala ${roomId}`);
    }

    // Se for viewer, tenta encontrar um transmissor ativo na sala
    if (role === "viewer") {
      // Espera pequeno delay para garantir que broadcaster já esteja registrado
      setTimeout(() => {
        const sockets = [...io.sockets.sockets.values()];
        const broadcaster = sockets.find(
          (s) => s.data?.roomId === roomId && s.data?.role === "broadcaster"
        );

        if (broadcaster) {
          console.log(`👁️ Viewer ${socket.id} encontrou transmissor ${broadcaster.id} na sala ${roomId}`);
          socket.emit("broadcaster-ready", { broadcasterId: broadcaster.id });
        } else {
          console.log(`⚠️ Nenhum transmissor encontrado na sala ${roomId}`);
        }
      }, 100);
    }
  });

  // Recebe e repassa SDP e ICE
  socket.on("offer", ({ to, description }) => {
    io.to(to).emit("offer", { from: socket.id, description });
  });

  socket.on("answer", ({ to, description }) => {
    io.to(to).emit("answer", { from: socket.id, description });
  });

  socket.on("candidate", ({ to, candidate }) => {
    io.to(to).emit("candidate", { from: socket.id, candidate });
  });

  // Quando alguém desconecta
  socket.on("disconnect", () => {
    const { roomId, role } = socket.data || {};
    console.log(`🔴 Cliente saiu: ${socket.id} (${role || "desconhecido"})`);

    if (roomId && role === "broadcaster") {
      socket.to(roomId).emit("broadcaster-disconnected");
      console.log(`🚫 Transmissor desconectado da sala ${roomId}`);
    }
  });
});

// Inicializa servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
