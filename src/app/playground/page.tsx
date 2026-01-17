"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_CODE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi Proyecto</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.2rem;
      opacity: 0.9;
    }
    button {
      margin-top: 2rem;
      padding: 1rem 2rem;
      font-size: 1rem;
      border: none;
      border-radius: 8px;
      background: white;
      color: #667eea;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hola Mundo!</h1>
    <p>Este es un ejemplo de HTML, CSS y JavaScript</p>
    <button onclick="saludar()">Haz clic aqui</button>
  </div>

  <script>
    function saludar() {
      alert('Hola! Tu codigo funciona perfectamente!');
    }
  </script>
</body>
</html>`;

// Function to extract HTML code from markdown code blocks
function extractHtmlFromResponse(text: string): string | null {
  // Match ```html ... ``` blocks
  const htmlBlockRegex = /```html\s*([\s\S]*?)```/gi;
  const matches = [...text.matchAll(htmlBlockRegex)];

  if (matches.length > 0) {
    // Return the last HTML block (most likely the complete one)
    return matches[matches.length - 1][1].trim();
  }

  // Also check for <!DOCTYPE html> without code blocks (direct HTML)
  if (text.includes("<!DOCTYPE html>") || text.includes("<!doctype html>")) {
    const doctypeIndex = text.toLowerCase().indexOf("<!doctype html>");
    const htmlEndIndex = text.toLowerCase().lastIndexOf("</html>");
    if (doctypeIndex !== -1 && htmlEndIndex !== -1) {
      return text.slice(doctypeIndex, htmlEndIndex + 7).trim();
    }
  }

  return null;
}

export default function Playground() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Model settings
  const [model, setModel] = useState<"grok-4-1-fast" | "grok-code-fast-1">("grok-4-1-fast");
  const [useReasoning, setUseReasoning] = useState(true);

  // Editor/Preview state
  const [code, setCode] = useState(DEFAULT_CODE);
  const [preview, setPreview] = useState("");
  const [rightPanelView, setRightPanelView] = useState<"code" | "preview">("code");

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle code detection from assistant messages
  const handleCodeDetection = useCallback((content: string) => {
    const extractedHtml = extractHtmlFromResponse(content);
    if (extractedHtml) {
      setCode(extractedHtml);
      setPreview(extractedHtml);
      setRightPanelView("preview");
    }
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model,
          useReasoning,
        }),
      });

      if (!response.ok) throw new Error("Error en la respuesta");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      const assistantMessage: Message = { role: "assistant", content: fullContent };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");

      // Check for HTML code in the response
      handleCodeDetection(fullContent);

    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, hubo un error. Por favor intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRun = () => {
    setPreview(code);
    setRightPanelView("preview");
  };

  const handleClearCode = () => {
    setCode("");
    setPreview("");
  };

  const handleResetCode = () => {
    setCode(DEFAULT_CODE);
    setPreview("");
  };

  const handleClearChat = () => {
    setMessages([]);
    setStreamingContent("");
  };

  // Render message content with code highlighting
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const langMatch = part.match(/```(\w*)\n?/);
        const lang = langMatch ? langMatch[1] : "";
        const codeContent = part.replace(/```\w*\n?/, "").replace(/```$/, "");
        return (
          <div key={index} className="my-2">
            {lang && (
              <div className="bg-slate-700 text-xs text-slate-300 px-3 py-1 rounded-t-lg">
                {lang}
              </div>
            )}
            <pre className={`bg-slate-800 p-3 ${lang ? "rounded-b-lg" : "rounded-lg"} overflow-x-auto text-sm`}>
              <code className="text-green-300">{codeContent}</code>
            </pre>
          </div>
        );
      }
      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">&lt;/&gt;</span>
              </div>
              <span className="text-white font-semibold text-lg">CodeLab</span>
            </Link>

            {/* Model selector and settings */}
            <div className="flex items-center gap-4">
              {/* Model selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Modelo:</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as typeof model)}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded-lg border border-slate-600 focus:outline-none focus:border-purple-500"
                >
                  <option value="grok-4-1-fast">Grok 4.1 Fast</option>
                  <option value="grok-code-fast-1">Grok Code Fast</option>
                </select>
              </div>

              {/* Reasoning toggle - only for grok-4-1-fast */}
              {model === "grok-4-1-fast" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Razonador:</label>
                  <button
                    onClick={() => setUseReasoning(!useReasoning)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      useReasoning ? "bg-purple-600" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        useReasoning ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel - Left */}
        <div className="w-full lg:w-2/5 flex flex-col border-r border-slate-700">
          {/* Chat header */}
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm text-slate-300 font-medium">Chat con Grok</span>
            </div>
            <button
              onClick={handleClearChat}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Limpiar chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streamingContent && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <svg className="w-12 h-12 mb-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm font-medium">Empieza una conversacion</p>
                <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                  Pidele a Grok que te ayude a crear una pagina web o preguntale cualquier duda
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    message.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-slate-700 text-slate-100"
                  }`}
                >
                  <div className="text-sm">{renderMessageContent(message.content)}</div>
                </div>
              </div>
            ))}

            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-2 bg-slate-700 text-slate-100">
                  <div className="text-sm">{renderMessageContent(streamingContent)}</div>
                  <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />
                </div>
              </div>
            )}

            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-slate-700 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-slate-700 shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje... (Enter para enviar)"
                className="flex-1 bg-slate-800 text-slate-100 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[48px] max-h-32"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Code/Preview */}
        <div className="hidden lg:flex w-3/5 flex-col">
          {/* Panel header with toggle */}
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setRightPanelView("code")}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
                  rightPanelView === "code"
                    ? "bg-slate-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Codigo
              </button>
              <button
                onClick={() => setRightPanelView("preview")}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
                  rightPanelView === "preview"
                    ? "bg-slate-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearCode}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={handleResetCode}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Ejemplo
              </button>
              <button
                onClick={handleRun}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-xs font-medium transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ejecutar
              </button>
            </div>
          </div>

          {/* Code view */}
          {rightPanelView === "code" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-slate-800/50 px-4 py-1.5 border-b border-slate-700/50 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs text-slate-400">index.html</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 w-full bg-slate-900 text-slate-100 p-4 font-mono text-sm resize-none focus:outline-none"
                placeholder="Pega tu codigo HTML aqui o pidele a Grok que lo genere..."
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview view */}
          {rightPanelView === "preview" && (
            <div className="flex-1 bg-white overflow-hidden">
              {preview ? (
                <iframe
                  srcDoc={preview}
                  className="w-full h-full border-0"
                  title="Preview"
                  sandbox="allow-scripts allow-modals"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                  <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-medium text-slate-500">Vista previa</p>
                  <p className="text-sm text-slate-400">Haz clic en &quot;Ejecutar&quot; para ver el resultado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile view hint */}
      <div className="lg:hidden bg-slate-800 border-t border-slate-700 p-3 text-center shrink-0">
        <p className="text-xs text-slate-400">
          El panel de codigo solo esta disponible en pantallas grandes
        </p>
      </div>
    </div>
  );
}
