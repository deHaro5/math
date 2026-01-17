"use client";

import { useState, useRef } from "react";
import Link from "next/link";

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

export default function Playground() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [preview, setPreview] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRun = () => {
    setPreview(code);
  };

  const handleClear = () => {
    setCode("");
    setPreview("");
  };

  const handleReset = () => {
    setCode(DEFAULT_CODE);
    setPreview("");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">&lt;/&gt;</span>
              </div>
              <span className="text-white font-semibold text-lg">CodeLab</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Ejemplo
              </button>
              <button
                onClick={handleRun}
                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ejecutar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Editor Panel */}
        <div className="w-full lg:w-1/2 flex flex-col border-r border-slate-700">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-sm text-slate-300 font-medium">index.html</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full bg-slate-900 text-slate-100 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            placeholder="Pega tu codigo HTML aqui..."
            spellCheck={false}
          />
        </div>

        {/* Preview Panel */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-sm text-slate-300 font-medium">Vista previa</span>
          </div>
          <div className="flex-1 bg-white">
            {preview ? (
              <iframe
                ref={iframeRef}
                srcDoc={preview}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-modals"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">Vista previa</p>
                <p className="text-sm">Haz clic en &quot;Ejecutar&quot; para ver el resultado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile hint */}
      <div className="lg:hidden bg-slate-800 border-t border-slate-700 p-3 text-center">
        <p className="text-xs text-slate-400">
          Consejo: Para mejor experiencia usa una pantalla mas grande
        </p>
      </div>
    </div>
  );
}
