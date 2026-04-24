import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { eq, and, ne, isNull } from "drizzle-orm";
import { db, conversationsTable, messagesTable, usersTable } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./notifications";
import { verifyJwtWithVersion } from "../middlewares/auth";

interface SocketAuth {
  userId: number;
  role: string;
}

declare module "socket.io" {
  interface Socket {
    auth?: SocketAuth;
  }
}

export let io: SocketIOServer | null = null;

export function setupSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: { origin: "*", credentials: false },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Token requis"));
    const payload = await verifyJwtWithVersion(token);
    if (!payload) return next(new Error("Session expirée"));
    socket.auth = { userId: payload.userId, role: payload.role };
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.auth!.userId;
    logger.info({ userId }, "Socket connected");

    // Join personal room for unread updates
    socket.join(`user:${userId}`);

    // Touch last_seen on connect, broadcast online status (respecting privacy).
    (async () => {
      try {
        await db.update(usersTable).set({ lastSeen: new Date() }).where(eq(usersTable.id, userId));
        const [u] = await db.select({ showOnlineStatus: usersTable.showOnlineStatus })
          .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (u?.showOnlineStatus) io!.emit("user_online", { userId });
      } catch (e) { logger.error({ e }, "online broadcast failed"); }
    })();

    socket.on("join_conversation", async (conversationId: number) => {
      const id = Number(conversationId);
      if (!Number.isFinite(id)) return;
      const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
      if (!conv) return;
      if (conv.producteurId !== userId && conv.transformateurId !== userId) return;
      socket.join(`conv:${id}`);
    });

    socket.on("leave_conversation", (conversationId: number) => {
      socket.leave(`conv:${Number(conversationId)}`);
    });

    socket.on("send_message", async (payload: { conversationId: number; content: string }) => {
      try {
        const convId = Number(payload?.conversationId);
        const content = String(payload?.content ?? "").trim();
        if (!Number.isFinite(convId) || !content) return;

        const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
        if (!conv) return;
        if (conv.producteurId !== userId && conv.transformateurId !== userId) return;

        const [msg] = await db.insert(messagesTable).values({
          conversationId: convId,
          senderId: userId,
          content,
        }).returning();

        const wire = {
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          content: msg.content,
          readAt: msg.readAt?.toISOString() ?? null,
          createdAt: msg.createdAt.toISOString(),
        };

        io!.to(`conv:${convId}`).emit("new_message", wire);

        // Notify other party for unread badge
        const otherId = conv.producteurId === userId ? conv.transformateurId : conv.producteurId;
        io!.to(`user:${otherId}`).emit("conversation_updated", { conversationId: convId });

        // Persistent notification for the other party
        try {
          const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
          const senderName = sender?.name ?? "Quelqu'un";
          await createNotification({
            userId: otherId,
            type: "nouveau_message",
            title: `Nouveau message de ${senderName}`,
            body: content.slice(0, 60),
            link: `/messages?conversation=${convId}`,
          });
        } catch (e) {
          logger.error({ e }, "notif nouveau_message failed");
        }
      } catch (err) {
        logger.error({ err }, "send_message failed");
      }
    });

    socket.on("mark_read", async (payload: { conversationId: number }) => {
      try {
        const convId = Number(payload?.conversationId);
        if (!Number.isFinite(convId)) return;
        const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
        if (!conv) return;
        if (conv.producteurId !== userId && conv.transformateurId !== userId) return;

        const updated = await db.update(messagesTable)
          .set({ readAt: new Date() })
          .where(and(
            eq(messagesTable.conversationId, convId),
            ne(messagesTable.senderId, userId),
            isNull(messagesTable.readAt),
          ))
          .returning();

        for (const m of updated) {
          const messageId = m.id;
          io!.to(`conv:${convId}`).emit("message_read", { messageId });
        }
      } catch (err) {
        logger.error({ err }, "mark_read failed");
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId }, "Socket disconnected");
      (async () => {
        try {
          // Only broadcast offline if this user has no other active sockets.
          const sockets = await io!.in(`user:${userId}`).fetchSockets();
          if (sockets.length === 0) {
            const lastSeen = new Date();
            await db.update(usersTable).set({ lastSeen }).where(eq(usersTable.id, userId));
            const [u] = await db.select({ showOnlineStatus: usersTable.showOnlineStatus })
              .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
            if (u?.showOnlineStatus) io!.emit("user_offline", { userId, last_seen: lastSeen.toISOString() });
          }
        } catch (e) { logger.error({ e }, "offline broadcast failed"); }
      })();
    });
  });

  return io;
}
