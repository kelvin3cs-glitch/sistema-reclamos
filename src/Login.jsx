import { useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Autenticar con Supabase Auth
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 2. Consultar el ROL en tu tabla de 'perfiles'
      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (errorPerfil) throw errorPerfil;

      // 3. Redirección Inteligente 🧠
      if (perfil.rol === 'QUIMICO' || perfil.rol === 'ADMIN') {
        navigate('/admin'); // Al tablero del Químico
      } else if (perfil.rol === 'ASESOR_VENTAS') {
        navigate('/vendedor'); // Al panel del Vendedor
      } else {
        alert('Tu usuario no tiene un rol asignado. Contacta a sistemas.');
      }

    } catch (error) {
      alert('Error de acceso: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Acceso al Sistema 🔐</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo Corporativo</label>
            <input
              type="email"
              required
              className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              required
              className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>

        {/* --- NUEVA SECCIÓN PARA CLIENTES --- */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-2">¿Eres Cliente?</p>
          <button 
            onClick={() => navigate('/consulta')}
            className="text-blue-600 font-bold hover:underline text-sm flex items-center justify-center gap-2 mx-auto"
          >
            🔍 Consultar estado de mi Reclamo
          </button>
        </div>

      </div>
    </div>
  );
}