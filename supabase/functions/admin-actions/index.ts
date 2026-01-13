import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
// ¡IMPORTANTE! Aquí usamos la SERVICE_ROLE_KEY porque necesitamos permiso para crear usuarios auth
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { action, email, password, nombre, rol } = await req.json();

    if (action === "CREAR_USUARIO") {
      // 1. Crear el usuario en Auth (Sistema de Login)
      const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Lo auto-confirmamos para que puedan entrar ya
        user_metadata: { nombre_completo: nombre }
      });

      if (authError) throw authError;

      // 2. Crear su perfil en la tabla 'perfiles' (Base de Datos)
      // Nota: Normalmente un Trigger lo haría, pero aquí aseguramos los datos exactos
      const { error: profileError } = await supabaseAdmin
        .from("perfiles")
        .insert({
          id: userData.user.id,
          email: email,
          nombre_completo: nombre,
          rol: rol,
          activo: true
        });

      if (profileError) {
        // Si falla el perfil, intentamos borrar el usuario auth para no dejar basura (opcional)
        await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
        throw profileError;
      }

      return new Response(JSON.stringify({ success: true, user: userData.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Acción no reconocida", { status: 400 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});