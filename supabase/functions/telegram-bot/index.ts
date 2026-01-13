import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("MY_SERVICE_KEY"); // OJO: Debe ser la Service Key para poder escribir en perfiles si hay RLS estricto
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const body = await req.json();

    // CASO A: NOTIFICAR (Salida)
    if (body.action === 'NOTIFICAR_CLIENTE') {
      const { chatId, mensaje } = body;
      await reply(chatId, mensaje);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CASO B: MENSAJE RECIBIDO (Entrada)
    const { message } = body;
    if (!message || !message.text) return new Response("OK");

    const chatId = message.chat.id;
    const text = message.text.trim();
    const firstName = message.chat.first_name || "Usuario";

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length < 2) {
        await reply(chatId, "⚠️ Por favor escanea el código QR del sistema.");
        return new Response("OK");
      }

      const codigo = parts[1].toUpperCase();
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

      // --- LOGICA NUEVA: ¿ES EMPLEADO O RECLAMO? ---
      
      // 1. SI ES EMPLEADO (Código empieza con "EMP-")
      if (codigo.startsWith("EMP-")) {
        // El código será algo como "EMP-JUAN123"
        // Buscamos en perfiles usando una columna 'codigo_vinculacion' (que crearemos en el front) o usamos el ID directo si es corto.
        // ESTRATEGIA: Para simplificar, asumiremos que guardamos el código temporal en una columna nueva o usamos el ID.
        // MEJORA: Vamos a buscar por ID de usuario que vendrá en el QR.
        
        // *Truco*: El QR tendrá el ID de Supabase (UUID) pero con prefijo. Ej: EMP-a0eebc...
        const userId = codigo.replace("EMP-", "");

        const { error } = await supabase
          .from("perfiles")
          .update({ telegram_chat_id: chatId.toString() })
          .eq("id", userId);

        if (error) {
          await reply(chatId, "❌ Error al vincular empleado. Verifica el código.");
        } else {
          await reply(chatId, `✅ *¡Bienvenido al Equipo!*\nHola ${firstName}, ahora recibirás tus alertas de trabajo por aquí.`);
        }

      } else {
        // 2. SI NO ES EMPLEADO, ES UN RECLAMO (Lógica antigua)
        const { data, error } = await supabase
          .from("reclamos")
          .update({ telegram_chat_id_cliente: chatId.toString() })
          .eq("codigo_erp", codigo)
          .select();

        if (error || !data || data.length === 0) {
          await reply(chatId, `❌ No encontramos el reclamo *${codigo}*.`);
        } else {
          await reply(chatId, `✅ *¡Vinculado!*\nHola ${firstName}, te avisaremos por aquí sobre tu reclamo *${codigo}*.`);
        }
      }

    } else {
      await reply(chatId, "🤖 Soy un bot de notificaciones automáticas.");
    }

    return new Response("OK");

  } catch (error) {
    console.error("🔥 Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

async function reply(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}