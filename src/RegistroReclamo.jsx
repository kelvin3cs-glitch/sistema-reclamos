import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import QRCode from "react-qr-code"; 
import { useNavigate } from 'react-router-dom';

export default function RegistroReclamo() {
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const navigate = useNavigate();
  
  // Estado para saber quién está logueado (TÚ)
  const [usuarioActual, setUsuarioActual] = useState(null);

  const [formData, setFormData] = useState({
    codigoErp: '',
    dniCliente: '',
    nombreCliente: '',
    telefonoCliente: '',
    motivo: ''
  })
  
  const [reclamoCreado, setReclamoCreado] = useState(null)

  // 1. AL CARGAR: Detectar automáticamente al Vendedor logueado
  useEffect(() => {
    const obtenerUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscamos tu nombre en la tabla perfiles
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUsuarioActual(perfil); // Guardamos tus datos (ID y Nombre)
      } else {
        navigate('/'); // Si no hay usuario, fuera
      }
    }
    obtenerUsuario();
  }, [navigate]);

  // --- FUNCIÓN DE NOTIFICACIÓN ---
  const notificarQuimicos = async (reclamo, nombreVendedor) => {
    try {
      const { data: quimicos } = await supabase
        .from('perfiles')
        .select('telegram_chat_id')
        .eq('rol', 'QUIMICO');

      if (!quimicos || quimicos.length === 0) return;

      const mensajeAlerta = `🚨 *NUEVO RECLAMO PENDIENTE*\n\nCódigo: *${reclamo.codigo_erp}*\nCliente: ${reclamo.nombre_cliente}\nVendedor: ${nombreVendedor}\n\n👉 *Motivo:* ${reclamo.motivo_reclamo}\n\nPor favor ingresa al sistema para emitir tu dictamen técnico.`;

      for (const q of quimicos) {
        if (q.telegram_chat_id) {
          await fetch('https://pdznmhuhblqvcypuiicn.supabase.co/functions/v1/telegram-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'NOTIFICAR_CLIENTE', 
              chatId: q.telegram_chat_id,
              mensaje: mensajeAlerta
            })
          });
        }
      }
    } catch (err) {
      console.error("Error notificando químicos:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)
    try {
      if (!usuarioActual) throw new Error('No se pudo identificar al vendedor. Recarga la página.')

      const nuevoReclamo = {
        codigo_erp: formData.codigoErp.toUpperCase(),
        dni_ruc_cliente: formData.dniCliente,
        nombre_cliente: formData.nombreCliente,
        telefono_cliente: formData.telefonoCliente,
        motivo_reclamo: formData.motivo,
        id_vendedor: usuarioActual.id, // <--- ASIGNACIÓN AUTOMÁTICA
        estado: 'PENDIENTE'
      }

      const { data, error } = await supabase.from('reclamos').insert([nuevoReclamo]).select()
      
      if (error) throw error
      
      const reclamoGuardado = data[0];
      setReclamoCreado(reclamoGuardado)
      
      // Usamos tu nombre real para la notificación
      await notificarQuimicos(reclamoGuardado, usuarioActual.nombre_completo);

      setFormData({ codigoErp: '', dniCliente: '', nombreCliente: '', telefonoCliente: '', motivo: '' })

    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-10">
      <div className="flex justify-between items-center mb-6 border-b pb-2">
        <h2 className="text-2xl font-bold text-gray-800">Nuevo Reclamo 🧪</h2>
        <button onClick={() => navigate('/vendedor')} className="text-sm text-blue-600 hover:underline">
          ← Volver a Mis Pendientes
        </button>
      </div>

      {mensaje && (
        <div className={`p-3 mb-4 rounded text-center font-bold ${mensaje.tipo === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {mensaje.texto}
        </div>
      )}

      {reclamoCreado ? (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 text-center animate-bounce-in flex flex-col items-center">
          <div className="text-5xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-blue-900">¡Reclamo Registrado!</h3>
          <p className="text-gray-600 mb-2">El equipo de Calidad ha sido notificado.</p>
          <p className="text-gray-600 mb-4 font-bold text-sm">Escanea para vincular al cliente:</p>
          
          <div className="bg-white p-4 rounded shadow-lg mb-4">
            <QRCode 
              value={`https://t.me/rrhh_kacs_bot?start=${reclamoCreado.codigo_erp}`} 
              size={180}
            />
          </div>

          <div className="bg-white p-2 rounded border font-mono text-xs select-all mb-4 text-gray-500">
            https://t.me/rrhh_kacs_bot?start={reclamoCreado.codigo_erp}
          </div>
          
          <button onClick={() => setReclamoCreado(null)} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
            Registrar Otro
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* AVISO DE IDENTIDAD (Opcional, para que sepas que el sistema te reconoce) */}
          {usuarioActual && (
            <div className="bg-gray-50 p-2 rounded border text-sm text-gray-600 flex justify-between">
              <span>👤 Registrando como: <strong>{usuarioActual.nombre_completo}</strong></span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Código ERP</label>
              <input required type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Ej: ABC001" 
                value={formData.codigoErp} onChange={e => setFormData({...formData, codigoErp: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">DNI / RUC</label>
              <input required type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1045..." 
                value={formData.dniCliente} onChange={e => setFormData({...formData, dniCliente: e.target.value})} />
            </div>
          </div>

          {/* ELIMINADO EL CAMPO "ASIGNAR VENDEDOR" */}

          <div>
            <label className="text-sm font-semibold text-gray-700">Motivo</label>
            <textarea className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" rows="2" 
              value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})}></textarea>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Nombre Cliente</label>
            <input required type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Razón Social o Nombre..." 
              value={formData.nombreCliente} onChange={e => setFormData({...formData, nombreCliente: e.target.value})} />
          </div>

           <div>
            <label className="text-sm font-semibold text-gray-700">Teléfono</label>
            <input type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="999..." 
              value={formData.telefonoCliente} onChange={e => setFormData({...formData, telefonoCliente: e.target.value})} />
          </div>

          <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
            {loading ? 'Guardando...' : 'Registrar Reclamo'}
          </button>
        </form>
      )}
    </div>
  )
}