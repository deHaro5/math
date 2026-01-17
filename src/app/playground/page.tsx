"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import CodeGenerationIndicator from "@/components/CodeGenerationIndicator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

// Function to inject custom styles for better preview experience
function enhanceHtml(html: string): string {
  const customStyles = `
    <style>
      /* Injected by CodeLab for better preview experience */
      ::-webkit-scrollbar { width: 0px; height: 0px; background: transparent; }
      ::-webkit-scrollbar-thumb { display: none; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      html, body { margin: 0; padding: 0; }
    </style>
  `;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${customStyles}</head>`);
  }
  return html + customStyles;
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Layout state
  const [chatWidth, setChatWidth] = useState(40); // Initial 40%
  const [isDragging, setIsDragging] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "code" | "preview">("chat");
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const startResizing = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        // Limit width between 20% and 80%
        if (newWidth >= 20 && newWidth <= 80) {
          setChatWidth(newWidth);
        }
      }
    },
    [isDragging]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isDragging, resize, stopResizing]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle code detection from assistant messages
  const handleCodeDetection = useCallback((content: string) => {
    const extractedHtml = extractHtmlFromResponse(content);
    if (extractedHtml) {
      setCode(extractedHtml);
      setPreview(enhanceHtml(extractedHtml));
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
        let hasStartedCode = false;
        let lastPreviewUpdate = 0;
        const PREVIEW_THROTTLE = 400; // Update preview every 400ms max

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

                  // Live preview: extract and show HTML as it's being generated
                  if (fullContent.includes("```html")) {
                    // Switch to preview view when code starts
                    if (!hasStartedCode) {
                      hasStartedCode = true;
                      setRightPanelView("preview");
                    }

                    // Throttle preview updates to avoid flickering
                    const now = Date.now();
                    const htmlStart = fullContent.indexOf("```html") + 7;
                    const htmlEnd = fullContent.lastIndexOf("```");
                    const isComplete = htmlEnd > htmlStart;

                    // Update if: complete, or throttle time passed and has </body> or </style>
                    const partialHtml = isComplete
                      ? fullContent.slice(htmlStart, htmlEnd).trim()
                      : fullContent.slice(htmlStart).trim();

                    // Only update preview if HTML has minimum structure or is complete
                    const hasMinStructure = partialHtml.includes("</style>") ||
                      partialHtml.includes("</body>") ||
                      partialHtml.includes("</html>");

                    if (isComplete || (hasMinStructure && now - lastPreviewUpdate > PREVIEW_THROTTLE)) {
                      lastPreviewUpdate = now;
                      setCode(partialHtml);
                      setPreview(enhanceHtml(partialHtml));
                    }
                  }
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
    setPreview(enhanceHtml(code));
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

  // Check if content has code blocks (complete or in progress)
  const hasCodeBlock = (content: string) => content.includes("```html");
  const isCodeBlockComplete = (content: string) => {
    const openCount = (content.match(/```html/gi) || []).length;
    const closeCount = (content.match(/```\s*$/gm) || []).length;
    // Also check for ``` followed by anything that's not a language identifier
    const allCloses = (content.match(/```(?!\w)/g) || []).length;
    return openCount > 0 && allCloses >= openCount;
  };

  // Render message content - hide code blocks and show indicator instead
  const renderMessageContent = (content: string, isStreaming = false) => {
    const hasCode = hasCodeBlock(content);
    const codeComplete = isCodeBlockComplete(content);

    // Split content into parts, separating code blocks
    const parts: { type: "text" | "code"; content: string }[] = [];
    let remaining = content;

    // Regex to match complete code blocks
    const codeBlockRegex = /```html[\s\S]*?```/gi;
    let lastIndex = 0;
    let match;

    const tempContent = content;
    const regex = /```html[\s\S]*?```/gi;

    while ((match = regex.exec(tempContent)) !== null) {
      // Add text before this code block
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: tempContent.slice(lastIndex, match.index) });
      }
      // Add code block marker
      parts.push({ type: "code", content: match[0] });
      lastIndex = regex.lastIndex;
    }

    // Add remaining text after last code block
    if (lastIndex < tempContent.length) {
      const remainingText = tempContent.slice(lastIndex);
      // Check if there's an incomplete code block
      if (remainingText.includes("```html") && !remainingText.includes("```", remainingText.indexOf("```html") + 7)) {
        // Split at the incomplete code block
        const incompleteStart = remainingText.indexOf("```html");
        if (incompleteStart > 0) {
          parts.push({ type: "text", content: remainingText.slice(0, incompleteStart) });
        }
        parts.push({ type: "code", content: remainingText.slice(incompleteStart) });
      } else {
        parts.push({ type: "text", content: remainingText });
      }
    }

    return parts.map((part, index) => {
      if (part.type === "code") {
        const isThisBlockComplete = part.content.match(/```\s*$/);
        return (
          <CodeGenerationIndicator
            key={index}
            isGenerating={!isThisBlockComplete}
            isComplete={!!isThisBlockComplete}
          />
        );
      }
      return (
        <div key={index} className="prose prose-invert prose-sm max-w-none text-white prose-p:text-white prose-headings:text-white prose-ul:text-white prose-ol:text-white prose-li:text-white prose-strong:text-white prose-strong:font-bold prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
        </div>
      );
    });
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 shrink-0 z-20">
        <div className="max-w-full mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">&lt;/&gt;</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">Thader Lab</span>
            </Link>

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden bg-slate-700 rounded-lg p-1 mx-2">
              <button
                onClick={() => setMobileTab("chat")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mobileTab === "chat" ? "bg-purple-600 text-white" : "text-slate-400"
                  }`}
              >
                Chat
              </button>
              <button
                onClick={() => setMobileTab("code")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mobileTab === "code" ? "bg-purple-600 text-white" : "text-slate-400"
                  }`}
              >
                Código
              </button>
              <button
                onClick={() => setMobileTab("preview")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mobileTab === "preview" ? "bg-purple-600 text-white" : "text-slate-400"
                  }`}
              >
                Preview
              </button>
            </div>

            {/* Model selector - hidden on very small screens to save space */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden xs:flex items-center gap-2">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Modelo:</label>
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
                    className={`relative w-10 h-5 rounded-full transition-colors ${useReasoning ? "bg-purple-600" : "bg-slate-600"
                      }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${useReasoning ? "translate-x-5" : ""
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
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        {/* Chat Panel - Left */}
        <div
          className={`flex-col border-r border-slate-700 h-full ${mobileTab === "chat" ? "flex w-full" : "hidden lg:flex"
            }`}
          style={{ width: !isMobile ? `${chatWidth}%` : undefined }}
        >
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col custom-scrollbar">
            {messages.length === 0 && !streamingContent && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${message.role === "user"
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

        {/* Resizer Handle */}
        <div
          className={`w-1 bg-slate-700 hover:bg-purple-500 cursor-col-resize transition-colors z-10 hidden lg:block ${isDragging ? "bg-purple-500" : ""
            }`}
          onMouseDown={startResizing}
        />

        {/* Right Panel - Code/Preview */}
        <div
          className={`flex-col h-full transition-all duration-300 ${(mobileTab === "code" || mobileTab === "preview") ? "flex w-full" : "hidden lg:flex"
            }`}
          style={{ width: !isMobile ? `${100 - chatWidth}%` : undefined }}
        >
          {/* Panel header with toggle */}
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
              {/* On mobile, we use the mobileTab switcher instead of this toggle if we want, 
                  but we'll keep this sync'd for desktop but hide it on mobile to avoid double controls if preferred.
                  Actually, let's keep it visible on mobile too for local switching. */}
              <button
                onClick={() => {
                  setRightPanelView("code");
                  setMobileTab("code");
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${rightPanelView === "code"
                  ? "bg-slate-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="hidden xs:inline">Codigo</span>
              </button>
              <button
                onClick={() => {
                  setRightPanelView("preview");
                  setMobileTab("preview");
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${rightPanelView === "preview"
                  ? "bg-slate-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="hidden xs:inline">Preview</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {rightPanelView === "preview" && (
                <button
                  onClick={() => setIsFullScreen(true)}
                  disabled={!preview}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Pantalla completa"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              )}
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
                className={`flex-1 w-full bg-slate-900 text-slate-100 p-4 font-mono text-sm resize-none focus:outline-none ${isDragging ? "pointer-events-none" : ""
                  }`}
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
                  className={`w-full h-full border-0 block ${isDragging ? "pointer-events-none" : ""}`}
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

      {/* Mobile view hint removed as it is now fully responsive */}

      {/* Full Screen Overlay */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white">
          <iframe
            srcDoc={enhanceHtml(code)}
            className="w-full h-full border-0 block"
            title="Full Screen Preview"
            sandbox="allow-scripts allow-modals"
          />
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-4 right-4 bg-slate-800 text-white p-2 rounded-full hover:bg-slate-700 transition-colors shadow-lg group"
            title="Salir de pantalla completa"
          >
            <svg className="w-6 h-6 group-hover:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
