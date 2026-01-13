import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from './supabaseClient';

// Recibe "allowedRoles": una lista de roles permitidos (ej: ['QUIMICO'])
export const ProtectedRoute = ({ allowedRoles }) => {
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Verificamos si hay sesión activa en Supabase
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log("⛔ No hay sesión. Redirigiendo...");
        setLoading(false);
        return; // No autorizado
      }

      // 2. Si hay sesión, verificamos el ROL en la base de datos
      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

      if (error || !perfil) {
        console.log("⛔ Error buscando perfil o usuario sin rol.");
        setLoading(false);
        return;
      }

      // 3. Verificamos si el rol del usuario está en la lista de permitidos
      if (allowedRoles.includes(perfil.rol)) {
        setIsAllowed(true); // ¡Pase usted!
      } else {
        console.log(`⛔ Rol ${perfil.rol} no tiene permiso para esta zona.`);
      }

      setLoading(false);
    };

    checkAuth();
  }, [allowedRoles]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Verificando permisos... 🕵️‍♂️</div>;

  // Si no está autorizado, lo mandamos al Login ("/")
  if (!isAllowed) return <Navigate to="/" replace />;

  // Si está autorizado, mostramos la página interna (Outlet)
  return <Outlet />;
};