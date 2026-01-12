import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("MY_SERVICE_KEY");
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

// Encabezados para permitir que tu Web hable con la Función (CORS)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  try {
    // 1. GESTIONAR LA PREGUNTA DE SEGURIDAD DEL NAVEGADOR (Preflight)
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const body = await req.json();

    // 🚨 CASO A: ORDEN DESDE TU DASHBOARD (Notificar Cliente)
    if (body.action === 'NOTIFICAR_CLIENTE') {
      const { chatId, mensaje } = body;
      console.log(`📤 Enviando notificación a ${chatId}`);
      
      await reply(chatId, mensaje);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 🚨 CASO B: MENSAJE DESDE TELEGRAM (Webhook normal)
    const { message } = body;
    if (!message || !message.text) return new Response("OK");

    const chatId = message.chat.id;
    const text = message.text.trim();
    const firstName = message.chat.first_name || "Cliente";

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length < 2) {
        await reply(chatId, "⚠️ Falta el código del reclamo.");
      } else {
        const codigoErp = parts[1].toUpperCase();
        const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
        
        const { data, error } = await supabase
          .from("reclamos")
          .update({ telegram_chat_id_cliente: chatId.toString() })
          .eq("codigo_erp", codigoErp)
          .select();

        if (error || !data || data.length === 0) {
          await reply(chatId, `❌ No encontramos el reclamo *${codigoErp}*.`);
        } else {
          await reply(chatId, `✅ *¡Vinculado!*\nHola ${firstName}, te avisaremos por aquí sobre tu reclamo *${codigoErp}*.`);
        }
      }
    } else {
      await reply(chatId, "🤖 Solo respondo a notificaciones automáticas.");
    }

    return new Response("OK");

  } catch (error) {
    console.error("🔥 Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function reply(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}