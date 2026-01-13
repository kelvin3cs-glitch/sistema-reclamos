import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import QRCode from "react-qr-code";
import { useNavigate } from 'react-router-dom';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const navigate = useNavigate();

  // Datos para nuevo usuario
  const [nuevoUsuario, setNuevoUsuario] = useState({
    email: '',
    password: 'Empresa2026', // Clave por defecto
    nombre: '',
    rol: 'ASESOR_VENTAS'
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('nombre_completo', { ascending: true });

    if (error) console.error("Error cargando usuarios:", error);
    else setUsuarios(data || []);
    setLoading(false);
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Llamamos a la Edge Function "admin-actions"
      const response = await fetch('https://pdznmhuhblqvcypuiicn.supabase.co/functions/v1/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Importante: Enviamos la Auth para que Supabase sepa quién pide esto
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          action: 'CREAR_USUARIO',
          email: nuevoUsuario.email,
          password: nuevoUsuario.password,
          nombre: nuevoUsuario.nombre,
          rol: nuevoUsuario.rol
        })
      });

      const resultado = await response.json();

      if (!response.ok) throw new Error(resultado.error || "Error al crear usuario");

      alert(`✅ Usuario ${nuevoUsuario.nombre} creado con éxito.\n\n👉 Muestrale el QR para que se vincule.`);
      setModalOpen(false);
      
      // Abrimos el QR del usuario recién creado automáticamente
      const userRecienCreado = { id: resultado.user.id, nombre_completo: nuevoUsuario.nombre };
      setUsuarioSeleccionado(userRecienCreado);
      setQrOpen(true);
      
      fetchUsuarios(); // Recargar lista
      // Limpiar formulario
      setNuevoUsuario({ email: '', password: 'Empresa2026', nombre: '', rol: 'ASESOR_VENTAS' });

    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const verQR = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setQrOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* CABECERA */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            🛡️ Gestión de Usuarios (Sistemas)
          </h1>
          <div className="flex gap-2">
            <button onClick={() => navigate('/admin')} className="text-gray-600 hover:text-blue-600 font-bold px-4">
              Ir al Tablero Químico
            </button>
            <button 
              onClick={() => setModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-bold"
            >
              + Nuevo Usuario
            </button>
          </div>
        </div>

        {/* TABLA */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 text-gray-700 uppercase text-sm">
              <tr>
                <th className="p-4">Nombre</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Usuario (Email)</th>
                <th className="p-4">Telegram</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {usuarios.map(u => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-bold">{u.nombre_completo}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold 
                      ${u.rol === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 
                        u.rol === 'QUIMICO' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-sm">{u.email}</td>
                  <td className="p-4">
                    {u.telegram_chat_id ? (
                      <span className="text-green-600 font-bold text-sm flex items-center gap-1">
                        🟢 Vinculado
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold text-sm flex items-center gap-1">
                        🔴 Pendiente
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => verQR(u)}
                      className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-black text-sm flex items-center gap-1 mx-auto"
                    >
                      📱 Ver QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="p-4 text-center text-gray-500">Cargando...</p>}
        </div>

        {/* --- MODAL CREAR USUARIO --- */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Nuevo Empleado</h2>
              <form onSubmit={handleCrearUsuario} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">Nombre Completo</label>
                  <input required type="text" className="w-full border p-2 rounded" 
                    value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario({...nuevoUsuario, nombre: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">Email (Usuario)</label>
                  <input required type="email" className="w-full border p-2 rounded" placeholder="juan@empresa.com"
                    value={nuevoUsuario.email} onChange={e => setNuevoUsuario({...nuevoUsuario, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">Contraseña Inicial</label>
                  <input required type="text" className="w-full border p-2 rounded bg-gray-50" 
                    value={nuevoUsuario.password} onChange={e => setNuevoUsuario({...nuevoUsuario, password: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">Rol</label>
                  <select className="w-full border p-2 rounded" 
                    value={nuevoUsuario.rol} onChange={e => setNuevoUsuario({...nuevoUsuario, rol: e.target.value})}>
                    <option value="ASESOR_VENTAS">Vendedor</option>
                    <option value="QUIMICO">Químico (Laboratorio)</option>
                    <option value="ADMIN">Administrador (Sistemas)</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end mt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-black px-4">Cancelar</button>
                  <button disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">
                    {loading ? 'Creando...' : 'Guardar Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL QR VINCULACIÓN --- */}
        {qrOpen && usuarioSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-8 text-center relative">
              <button onClick={() => setQrOpen(false)} className="absolute top-2 right-4 text-2xl text-gray-500 hover:text-black">&times;</button>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">Vinculación Telegram</h3>
              <p className="text-gray-500 mb-6">Pide a <span className="font-bold text-blue-600">{usuarioSeleccionado.nombre_completo}</span> que escanee esto:</p>
              
              <div className="flex justify-center mb-6">
                {/* AQUÍ ESTÁ LA MAGIA:
                   Generamos el código EMP-{ID_USUARIO}
                   El bot leerá el prefijo EMP- y sabrá que es un empleado.
                */}
                <QRCode value={`https://t.me/rrhh_kacs_bot?start=EMP-${usuarioSeleccionado.id}`} size={200} />
              </div>

              <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all text-gray-500">
                EMP-{usuarioSeleccionado.id}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}