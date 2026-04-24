import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListConversations,
  useListMessages,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
} from "@/api-client";
import type {
  ConversationWithDetails,
  Message,
} from "@/api-client";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send, ArrowLeft, Package } from "lucide-react";
import { connectSocket } from "@/lib/socket";
import { StarRating } from "@/components/star-rating";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<number | null>(() => {
    const hash = window.location.hash.replace("#", "");
    const n = Number(hash);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const [draft, setDraft] = useState("");
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convLoading } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      enabled: !!token,
      refetchInterval: 15000,
    },
  });

  const { data: messagesPage, isLoading: msgsLoading } = useListMessages(
    activeId ?? 0,
    {},
    {
      query: {
        queryKey: getListMessagesQueryKey(activeId ?? 0, {}),
        enabled: !!activeId,
      },
    },
  );

  const activeConv = useMemo<ConversationWithDetails | undefined>(
    () => conversations?.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  // Initialize liveMessages from page
  useEffect(() => {
    if (messagesPage?.messages) {
      setLiveMessages(messagesPage.messages);
    }
  }, [messagesPage]);

  // Socket connection + listeners
  useEffect(() => {
    if (!token) return;
    const s = connectSocket();

    const onNewMessage = (msg: Message) => {
      if (msg.conversationId === activeId) {
        setLiveMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark as read immediately if it's from the other party
        if (msg.senderId !== user?.id) {
          s.emit("mark_read", { conversationId: activeId });
        }
      }
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    };

    const onConvUpdated = () => {
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    };

    const onMessageRead = ({ messageId }: { messageId: number }) => {
      setLiveMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, readAt: new Date().toISOString() } : m)),
      );
    };

    s.on("new_message", onNewMessage);
    s.on("conversation_updated", onConvUpdated);
    s.on("message_read", onMessageRead);

    return () => {
      s.off("new_message", onNewMessage);
      s.off("conversation_updated", onConvUpdated);
      s.off("message_read", onMessageRead);
    };
  }, [token, activeId, user?.id, queryClient]);

  // Join conversation room
  useEffect(() => {
    if (!activeId || !token) return;
    const s = connectSocket();
    const join = () => {
      s.emit("join_conversation", activeId);
      s.emit("mark_read", { conversationId: activeId });
    };
    if (s.connected) join();
    else s.once("connect", join);
    return () => {
      s.emit("leave_conversation", activeId);
    };
  }, [activeId, token]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages]);

  // Update URL hash
  useEffect(() => {
    if (activeId) window.location.hash = String(activeId);
  }, [activeId]);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const handleSend = () => {
    const content = draft.trim();
    if (!content || !activeId) return;
    const s = connectSocket();
    s.emit("send_message", { conversationId: activeId, content });
    setDraft("");
  };

  return (
    <div className="container mx-auto px-0 md:px-6 max-w-7xl flex-1 flex">
      <div className="flex flex-1 w-full bg-card md:rounded-xl md:my-6 md:shadow-sm md:ring-1 md:ring-border/50 overflow-hidden min-h-[calc(100dvh-8rem)]">
        {/* Left: conversation list */}
        <aside
          className={`${activeId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r bg-background`}
        >
          <div className="p-4 border-b">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : conversations && conversations.length > 0 ? (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${activeId === c.id ? "bg-primary/5" : ""}`}
                  data-testid={`conversation-item-${c.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.otherPartyName}</div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Package className="h-3 w-3" />
                        {c.offerTitle}
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-1">
                        {c.lastMessage ?? "Commencer une discussion"}
                      </div>
                    </div>
                    {c.unreadCount > 0 && (
                      <Badge className="bg-red-500 hover:bg-red-600 text-white shrink-0">
                        {c.unreadCount}
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground">Aucune conversation</p>
                <p className="text-sm mt-1">
                  Démarrez une discussion depuis le marketplace.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Right: chat window */}
        <section className={`${activeId ? "flex" : "hidden md:flex"} flex-col flex-1 bg-muted/20`}>
          {activeConv ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b bg-background">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setActiveId(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <Link
                    href={`/profil/${activeConv.otherPartyId}`}
                    className="font-semibold truncate hover:underline block"
                    data-testid={`link-chat-profile-${activeConv.otherPartyId}`}
                  >
                    {activeConv.otherPartyName}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {activeConv.offerTitle}
                    </span>
                    <StarRating
                      value={activeConv.otherPartyRatingAvg ?? 0}
                      count={activeConv.otherPartyRatingCount ?? 0}
                      showCount={false}
                      size={12}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {msgsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-2/3" />
                    ))}
                  </div>
                ) : liveMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Commencer une discussion</p>
                  </div>
                ) : (
                  liveMessages.map((m, i) => {
                    const mine = m.senderId === user.id;
                    const prev = liveMessages[i - 1];
                    const showName = !prev || prev.senderId !== m.senderId;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        {showName && !mine && (
                          <div className="text-xs text-muted-foreground mb-1 ml-2">
                            {activeConv.otherPartyName}
                          </div>
                        )}
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? "bg-[#16a34a] text-white rounded-br-sm" : "bg-[#f3f4f6] text-foreground rounded-bl-sm"}`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          <div
                            className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? "text-white/80 justify-end" : "text-muted-foreground"}`}
                          >
                            {formatTime(m.createdAt)}
                            {mine && m.readAt && <span className="ml-1">Vu ✓✓</span>}
                            {mine && !m.readAt && <span className="ml-1">✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t bg-background flex gap-2">
                <Input
                  placeholder="Écrire un message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!draft.trim()}
                  className="gap-2"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Envoyer</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center flex-1 text-center p-8 text-muted-foreground">
              <Card className="border-dashed bg-transparent shadow-none p-8">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium text-foreground">Sélectionnez une conversation</h3>
                <p className="text-sm mt-2 max-w-sm">
                  Choisissez une discussion à gauche ou démarrez-en une depuis le marketplace.
                </p>
              </Card>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
