import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function DashboardQuimico() {
  const [reclamos, setReclamos] = useState([]);
  const [nombresVendedores, setNombresVendedores] = useState({}); // 🧠 Memoria para guardar nombres
  const [loading, setLoading] = useState(true);

  // 1. Cargar datos al iniciar
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    
    // A. Traer los Reclamos
    const { data: dataReclamos, error: errorReclamos } = await supabase
      .from('reclamos')
      .select('*')
      .order('created_at', { ascending: false });

    if (errorReclamos) console.error('Error reclamos:', errorReclamos);

    // B. Traer los Nombres de los Vendedores (Perfiles)
    // Truco: Traemos todos los perfiles para hacer un "cruce" rápido
    const { data: dataPerfiles, error: errorPerfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo');

    if (errorPerfiles) console.error('Error perfiles:', errorPerfiles);

    // C. Crear un "Diccionario" de nombres
    // Convertimos la lista en un objeto: { "id_usuario": "Juan Pérez", ... }
    const mapaNombres = {};
    if (dataPerfiles) {
      dataPerfiles.forEach(perfil => {
        mapaNombres[perfil.id] = perfil.nombre_completo;
      });
    }

    setReclamos(dataReclamos || []);
    setNombresVendedores(mapaNombres);
    setLoading(false);
  };

  // Función auxiliar para enviar mensaje al Bot
  const enviarNotificacionTelegram = async (chatId, mensaje) => {
    try {
      await fetch('https://pdznmhuhblqvcypuiicn.supabase.co/functions/v1/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'NOTIFICAR_CLIENTE',
          chatId: chatId,
          mensaje: mensaje
        })
      });
      return true;
    } catch (err) {
      console.error("Error enviando Telegram:", err);
      return false;
    }
  };

  // 2. Función PRINCIPAL: EMITIR DICTAMEN
  const emitirDictamen = async (id, dictamen, codigo, chatIdCliente, idVendedor) => {
    
    if (!confirm(`¿Confirmas que el reclamo ${codigo} ${dictamen}?`)) return;

    const { error } = await supabase
      .from('reclamos')
      .update({
        dictamen: dictamen,
        estado: 'EN_GESTION'
      })
      .eq('id', id);

    if (error) {
      alert('Error al guardar dictamen: ' + error.message);
      return;
    }

    let resumenNotificaciones = "Dictamen guardado en BD. ✅";

    // Notificar al CLIENTE
    if (chatIdCliente) {
      const msjCliente = dictamen === 'PROCEDE'
        ? `✅ *¡BUENAS NOTICIAS!*\n\nTu reclamo *${codigo}* ha sido APROBADO por garantía.\n\nNos pondremos en contacto contigo para coordinar la solución.`
        : `❌ *ACTUALIZACIÓN*\n\nTu reclamo *${codigo}* ha sido revisado y se determinó que NO PROCEDE.\n\nEl asesor te contactará para explicarte los detalles.`;
      
      await enviarNotificacionTelegram(chatIdCliente, msjCliente);
      resumenNotificaciones += "\n- Cliente notificado 👤";
    }

    // Notificar al VENDEDOR
    if (idVendedor) {
      const { data: vendedorData } = await supabase
        .from('perfiles')
        .select('telegram_chat_id')
        .eq('id', idVendedor)
        .single();

      if (vendedorData?.telegram_chat_id) {
        const msjVendedor = `🔔 *ATENCIÓN VENDEDOR*\n\nEl Químico acaba de dictaminar el reclamo *${codigo}*.\n\nDictamen: *${dictamen}*\n\n👉 Por favor ingresa al sistema y realiza el CIERRE ADMINISTRATIVO.`;
        
        await enviarNotificacionTelegram(vendedorData.telegram_chat_id, msjVendedor);
        resumenNotificaciones += "\n- Vendedor notificado 👔";
      }
    }

    alert(resumenNotificaciones);
    cargarDatos(); // Recargar tabla
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto"> {/* Hice la tabla un poco más ancha (7xl) para que quepa la columna extra */}
        
        {/* CABECERA */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            👨‍🔬 Tablero de Control de Calidad
          </h1>
          
          <button 
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              const { data } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
              if (data && data.rol === 'ADMIN') {
                window.location.href = '/usuarios';
              } else {
                alert('⛔ Acceso denegado. Solo personal de Sistemas.');
              }
            }}
            className="text-sm text-gray-500 hover:text-blue-600 underline font-medium transition"
          >
            ⚙️ Gestión Usuarios
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Cargando reclamos...</p>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-200 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="p-4 border-b">Fecha</th>
                  <th className="p-4 border-b">Código</th>
                  <th className="p-4 border-b">Cliente</th>
                  {/* NUEVA COLUMNA */}
                  <th className="p-4 border-b text-blue-800 bg-blue-50">Vendedor</th> 
                  <th className="p-4 border-b">Estado Telegram</th>
                  <th className="p-4 border-b">Dictamen / Estado</th>
                  <th className="p-4 border-b text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 text-sm">
                {reclamos.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 border-b last:border-0">
                    <td className="p-4">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-mono font-bold text-blue-600">
                      {r.codigo_erp}
                    </td>
                    <td className="p-4">
                      {r.nombre_cliente || 'Anónimo'}
                    </td>
                    
                    {/* CELDA VENDEDOR */}
                    <td className="p-4 font-medium text-gray-800 bg-gray-50">
                      {nombresVendedores[r.id_vendedor] ? (
                        <span className="flex items-center gap-1">
                           👤 {nombresVendedores[r.id_vendedor]}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No asignado</span>
                      )}
                    </td>

                    <td className="p-4">
                      {r.telegram_chat_id_cliente ? (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
                          ✅ Vinculado
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                          ⏳ Esperando
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {r.dictamen ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold
                          ${r.dictamen === 'PROCEDE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        `}>
                          {r.dictamen}
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                          {r.estado}
                        </span>
                      )}
                       {r.estado === 'CERRADO' && (
                        <span className="ml-2 text-xs text-gray-400 font-mono border px-1 rounded">
                          CERRADO
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      {r.estado !== 'CERRADO' && (
                        <>
                          <button
                            onClick={() => emitirDictamen(r.id, 'PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente, r.id_vendedor)}
                            className={`p-2 rounded shadow transition text-white 
                              ${r.dictamen === 'PROCEDE' ? 'bg-green-700' : 'bg-green-500 hover:bg-green-600'}
                            `}
                            title="Dictamen: PROCEDE"
                          >
                            ✅
                          </button>

                          <button
                            onClick={() => emitirDictamen(r.id, 'NO PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente, r.id_vendedor)}
                            className={`p-2 rounded shadow transition text-white 
                              ${r.dictamen === 'NO PROCEDE' ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}
                            `}
                            title="Dictamen: NO PROCEDE"
                          >
                            ❌
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {reclamos.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No hay reclamos registrados aún.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}