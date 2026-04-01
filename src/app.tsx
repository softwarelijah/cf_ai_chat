import { useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") !== "light";
    }
    return true;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const agent = useAgent({
    agent: "ChatAgent",
    onStateUpdate: (state: Record<string, unknown>) => {
      const notif = state.lastNotification as
        | { type: string; message: string; timestamp: string }
        | undefined;
      if (notif && notif.timestamp !== lastNotifTs.current) {
        lastNotifTs.current = notif.timestamp;
        setNotification(notif.message);
        setTimeout(() => setNotification(null), 5000);
      }
    },
  });

  const {
    messages,
    sendMessage,
    status,
    clearHistory,
    addToolApprovalResponse,
  } = useAgentChat({
    agent,
    onToolCall: async ({ toolCall, addToolOutput }) => {
      if (toolCall.toolName === "getUserTimezone") {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
    },
  });

  const [input, setInput] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const lastNotifTs = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className={`flex flex-col h-screen ${darkMode ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900"}`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
        <div>
          <h1 className="text-lg font-semibold">cf_ai_chat</h1>
          <p className={`text-xs ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>
            Powered by Llama 3.3 on Cloudflare Workers AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => clearHistory()}
            className={`text-sm px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
              darkMode
                ? "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
                : "border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400"
            }`}
          >
            Clear
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`text-sm px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
              darkMode
                ? "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
                : "border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400"
            }`}
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* Notification banner */}
      {notification && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
          {notification}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <h2 className={`text-xl font-medium ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                Start a conversation
              </h2>
              <p className={`text-sm ${darkMode ? "text-zinc-600" : "text-zinc-400"}`}>
                Messages persist across sessions. Try asking about the weather, scheduling a reminder, or just chat.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  message.role === "user"
                    ? darkMode
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-zinc-100 text-zinc-500"
                    : "bg-orange-500 text-white"
                }`}
              >
                {message.role === "user" ? "Y" : "AI"}
              </div>
              <div className="flex-1 pt-1 space-y-2">
                {message.parts?.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p key={i} className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type === "tool-invocation") {
                    return (
                      <ToolView
                        key={i}
                        part={part}
                        darkMode={darkMode}
                        onApprove={() =>
                          addToolApprovalResponse({
                            toolCallId: part.toolInvocation.toolCallId,
                            approve: true,
                          })
                        }
                        onReject={() =>
                          addToolApprovalResponse({
                            toolCallId: part.toolInvocation.toolCallId,
                            approve: false,
                          })
                        }
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                AI
              </div>
              <div className="flex items-center gap-1 pt-2">
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`px-6 py-4 border-t ${darkMode ? "border-zinc-800" : "border-zinc-200"}`}>
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className={`flex-1 px-4 py-3 rounded-xl text-[15px] outline-none transition-colors ${
              darkMode
                ? "bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500"
                : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-orange-500"
            }`}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 bg-orange-500 text-white rounded-xl font-medium text-[15px] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool result / approval UI
// ---------------------------------------------------------------------------
function ToolView({
  part,
  darkMode,
  onApprove,
  onReject,
}: {
  part: { type: "tool-invocation"; toolInvocation: Record<string, unknown> };
  darkMode: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const inv = part.toolInvocation;
  const state = inv.state as string;
  const toolName = inv.toolName as string;

  if (state === "approval-required") {
    return (
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          darkMode ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <p className="font-medium mb-2">
          Tool "{toolName}" needs approval
        </p>
        <pre className={`text-xs mb-3 ${darkMode ? "text-zinc-400" : "text-zinc-500"}`}>
          {JSON.stringify(inv.args, null, 2)}
        </pre>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="px-3 py-1 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-500 cursor-pointer"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-500 cursor-pointer"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (state === "output-available") {
    return (
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          darkMode ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <p className={`text-xs font-medium mb-1 ${darkMode ? "text-zinc-500" : "text-zinc-400"}`}>
          {toolName}
        </p>
        <pre className={`text-xs ${darkMode ? "text-zinc-300" : "text-zinc-600"}`}>
          {JSON.stringify(inv.output, null, 2)}
        </pre>
      </div>
    );
  }

  // Loading / streaming state
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
        darkMode ? "border-zinc-700 bg-zinc-900 text-zinc-400" : "border-zinc-200 bg-zinc-50 text-zinc-500"
      }`}
    >
      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      Running {toolName}...
    </div>
  );
}
