import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function POST(request: NextRequest) {
  try {
    const { messages, model, useReasoning } = await request.json();

    // Determine the model based on selection and reasoning toggle
    let selectedModel = model || "grok-4-1-fast";

    // For grok-4-1-fast, append reasoning suffix based on toggle
    if (model === "grok-4-1-fast") {
      selectedModel = useReasoning ? "grok-4-1-fast-reasoning" : "grok-4-1-fast-non-reasoning";
    }
    // grok-code-fast-1 is always a reasoning model, no toggle needed

    const systemMessage = {
      role: "system" as const,
      content: `Eres Grok, un asistente de programacion experto. Ayudas a estudiantes de bachillerato a crear proyectos web.

Cuando el usuario te pida crear una pagina web o codigo HTML:
1. Genera un archivo HTML completo y funcional con CSS y JavaScript incluidos
2. Usa estilos modernos y atractivos
3. Asegurate de que el codigo sea educativo y facil de entender
4. Incluye comentarios explicativos en el codigo

IMPORTANTE: Cuando generes codigo HTML completo, envuelvelo en un bloque de codigo con triple backticks y la etiqueta html:
\`\`\`html
<!DOCTYPE html>
...tu codigo aqui...
</html>
\`\`\`

Si el usuario solo hace preguntas o conversacion normal, responde de forma amigable y educativa sin generar codigo a menos que lo pida.`,
    };

    const stream = await client.chat.completions.create({
      model: selectedModel,
      messages: [systemMessage, ...messages],
      stream: true,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(
      JSON.stringify({ error: "Error al procesar la solicitud" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
