import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function MisReclamos() {
  const [reclamos, setReclamos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); 
  
  const [reclamoSeleccionado, setReclamoSeleccionado] = useState(null);
  const [datosCierre, setDatosCierre] = useState({ tipo: '', sustento: '' });

  const getOpcionesDisponibles = (dictamen) => {
    if (dictamen === 'PROCEDE') {
      return [
        { value: 'NOTA_CREDITO', label: 'Nota de Crédito' },
        { value: 'CAMBIO_PRODUCTO', label: 'Cambio de Producto' },
        { value: 'OTRO', label: 'Otro' }
      ];
    } 
    if (dictamen === 'NO PROCEDE') {
      return [
        { value: 'RECHAZO_DEFINITIVO', label: 'Rechazo Definitivo' },
        { value: 'OTRO', label: 'Otro / Cortesía Comercial' }
      ];
    }
    return []; 
  };

  useEffect(() => {
    fetchPendientes();
  }, []);

  const fetchPendientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reclamos')
      .select('*')
      .eq('estado', 'EN_GESTION')
      .order('created_at', { ascending: false });

    if (error) console.error('Error:', error);
    else setReclamos(data);
    setLoading(false);
  };

  const abrirModalCierre = (reclamo) => {
    const opciones = getOpcionesDisponibles(reclamo.dictamen);
    setReclamoSeleccionado(reclamo);
    setDatosCierre({ 
      tipo: opciones[0]?.value || '', 
      sustento: '' 
    });
  };

  // --- FUNCIÓN DE NOTIFICACIÓN CIERRE AL QUIMICO ---
  const notificarCierreQuimicos = async (reclamo, solucion, sustento) => {
    try {
      const { data: quimicos } = await supabase
        .from('perfiles')
        .select('telegram_chat_id')
        .eq('rol', 'QUIMICO');

      if (!quimicos) return;

      const mensaje = `✅ *RECLAMO FINALIZADO*\n\nEl vendedor ha procesado el cierre administrativo del caso *${reclamo.codigo_erp}*.\n\n🛠️ *Solución:* ${solucion}\n📝 *Sustento:* ${sustento}`;

      for (const q of quimicos) {
        if (q.telegram_chat_id) {
          await fetch('https://pdznmhuhblqvcypuiicn.supabase.co/functions/v1/telegram-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'NOTIFICAR_CLIENTE', 
              chatId: q.telegram_chat_id,
              mensaje: mensaje
            })
          });
        }
      }
    } catch (err) {
      console.error("Error notificando cierre:", err);
    }
  };

  const handleCerrarCaso = async (e) => {
    e.preventDefault();
    if (!reclamoSeleccionado) return;

    const { error } = await supabase
      .from('reclamos')
      .update({
        estado: 'CERRADO',
        tipo_solucion: datosCierre.tipo,
        sustento_cierre: datosCierre.sustento
      })
      .eq('id', reclamoSeleccionado.id);

    if (error) {
      alert('Error al cerrar: ' + error.message);
    } else {
      // Notificar al Químico
      await notificarCierreQuimicos(reclamoSeleccionado, datosCierre.tipo, datosCierre.sustento);
      
      alert('¡Caso cerrado correctamente! El químico ha sido notificado. 🎉');
      setReclamoSeleccionado(null);
      fetchPendientes();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              💼 Mis Pendientes (Gestión Comercial)
            </h1>
            <button 
              onClick={() => navigate('/nuevo-reclamo')}
              className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700 transition"
            >
              + Nuevo Reclamo
            </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Cargando tareas...</p>
        ) : (
          <div className="grid gap-4">
            {reclamos.length === 0 && (
              <div className="bg-white p-8 rounded shadow text-center text-gray-500">
                ¡Todo limpio! No tienes reclamos pendientes de gestión. 🏖️
              </div>
            )}

            {reclamos.map((r) => (
              <div key={r.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500 flex justify-between items-center transition hover:shadow-md">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-blue-700">{r.codigo_erp}</span>
                    <span className="text-xs text-gray-400">| {new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-gray-800 font-semibold">{r.nombre_cliente}</div>
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    Dictamen Químico: 
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.dictamen === 'PROCEDE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.dictamen}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => abrirModalCierre(r)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium"
                >
                  Gestionar / Cerrar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* --- MODAL DE CIERRE --- */}
        {reclamoSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in-up">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  Cerrar Caso: <span className="text-blue-600">{reclamoSeleccionado.codigo_erp}</span>
                </h3>
                <span className={`text-xs px-2 py-1 rounded font-bold ${reclamoSeleccionado.dictamen === 'PROCEDE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {reclamoSeleccionado.dictamen}
                </span>
              </div>
              
              <form onSubmit={handleCerrarCaso} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Solución Aplicada
                  </label>
                  <select 
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                    value={datosCierre.tipo}
                    onChange={e => setDatosCierre({...datosCierre, tipo: e.target.value})}
                  >
                    {getOpcionesDisponibles(reclamoSeleccionado.dictamen).map(opcion => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    * Opciones filtradas según el dictamen técnico.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Sustento / Comentario</label>
                  <textarea 
                    required
                    placeholder={reclamoSeleccionado.dictamen === 'PROCEDE' 
                      ? "Ej: Se emitió Nota de Crédito NC-001..." 
                      : "Ej: Se explicó al cliente el motivo del rechazo..."}
                    className="w-full border p-2 rounded h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={datosCierre.sustento}
                    onChange={e => setDatosCierre({...datosCierre, sustento: e.target.value})}
                  ></textarea>
                </div>

                <div className="flex gap-2 justify-end mt-6">
                  <button type="button" onClick={() => setReclamoSeleccionado(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 font-medium">
                    Cancelar
                  </button>
                  <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 shadow">
                    Confirmar Cierre
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}