"use client";

import { useState, useEffect } from "react";

const GENERATING_PHRASES = [
  "Estructurando el HTML...",
  "Aplicando estilos CSS...",
  "Escribiendo el codigo...",
  "Añadiendo interactividad...",
  "Optimizando el diseño...",
  "Creando la estructura...",
  "Definiendo los estilos...",
  "Preparando el JavaScript...",
  "Configurando el layout...",
  "Ajustando los colores...",
  "Finalizando detalles...",
  "Puliendo el codigo...",
];

interface CodeGenerationIndicatorProps {
  isGenerating: boolean;
  isComplete: boolean;
}

export default function CodeGenerationIndicator({
  isGenerating,
  isComplete,
}: CodeGenerationIndicatorProps) {
  const [currentPhrase, setCurrentPhrase] = useState(GENERATING_PHRASES[0]);

  useEffect(() => {
    if (!isGenerating || isComplete) return;

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * GENERATING_PHRASES.length);
      setCurrentPhrase(GENERATING_PHRASES[randomIndex]);
    }, 1500 + Math.random() * 1000); // Random interval between 1.5s and 2.5s

    return () => clearInterval(interval);
  }, [isGenerating, isComplete]);

  if (!isGenerating && !isComplete) return null;

  return (
    <div className="my-3 bg-slate-800/50 border border-slate-600/50 rounded-xl p-4">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isComplete
            ? "bg-green-500/20"
            : "bg-purple-500/20"
        }`}>
          {isComplete ? (
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-purple-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${
              isComplete ? "text-green-400" : "text-purple-300"
            }`}>
              {isComplete ? "Codigo generado" : "Generando codigo"}
            </span>
            {isComplete && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                Completado
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isComplete ? "El codigo esta listo en el editor" : currentPhrase}
          </p>
        </div>

        {/* Progress dots for generating state */}
        {!isComplete && (
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    </div>
  );
}
