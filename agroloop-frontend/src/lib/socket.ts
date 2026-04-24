import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketUrl(): string {
  // socket.io path is mounted at the root domain (proxied via /socket.io)
  const { protocol, host } = window.location;
  return `${protocol}//${host}`;
}

export function getSocket(): Socket {
  const token = localStorage.getItem("agroloop_token");
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: { token },
    });
  } else {
    socket.auth = { token } as any;
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
