import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function DashboardQuimico() {
  const [reclamos, setReclamos] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar reclamos al iniciar
  useEffect(() => {
    fetchReclamos();
  }, []);

  const fetchReclamos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reclamos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error cargando reclamos:', error);
    else setReclamos(data);
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
    
    // A. Confirmación visual
    if (!confirm(`¿Confirmas que el reclamo ${codigo} ${dictamen}?`)) return;

    // B. Actualizar BD
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

    // --- C. NOTIFICACIONES ---
    let resumenNotificaciones = "Dictamen guardado en BD. ✅";

    // 1. Notificar al CLIENTE
    if (chatIdCliente) {
      const msjCliente = dictamen === 'PROCEDE'
        ? `✅ *¡BUENAS NOTICIAS!*\n\nTu reclamo *${codigo}* ha sido APROBADO por garantía.\n\nNos pondremos en contacto contigo para coordinar la solución.`
        : `❌ *ACTUALIZACIÓN*\n\nTu reclamo *${codigo}* ha sido revisado y se determinó que NO PROCEDE.\n\nEl asesor te contactará para explicarte los detalles.`;
      
      await enviarNotificacionTelegram(chatIdCliente, msjCliente);
      resumenNotificaciones += "\n- Cliente notificado 👤";
    }

    // 2. Notificar al VENDEDOR
    if (idVendedor) {
      const { data: vendedorData } = await supabase
        .from('perfiles')
        .select('telegram_chat_id')
        .eq('id', idVendedor)
        .single();

      if (vendedorData?.telegram_chat_id) {
        const msjVendedor = `🔔 *ATENCIÓN VENDEDOR*\n\nEl Químico acaba de dictaminar el reclamo *${codigo}*.\n\nDictamen: *${dictamen}*\n\n👉 Por favor ingresa al sistema y realiza el CIERRE ADMINISTRATIVO (Nota de crédito / Rechazo).`;
        
        await enviarNotificacionTelegram(vendedorData.telegram_chat_id, msjVendedor);
        resumenNotificaciones += "\n- Vendedor notificado 👔";
      }
    }

    alert(resumenNotificaciones);
    fetchReclamos(); // Recargar tabla
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* CABECERA CON BOTÓN SECRETO DE ADMIN */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            👨‍🔬 Tablero de Control de Calidad
          </h1>
          
          <button 
            onClick={async () => {
              // Verificación rápida de rol antes de navegar
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
              <thead className="bg-gray-200 text-gray-700 uppercase text-sm">
                <tr>
                  <th className="p-4 border-b">Fecha</th>
                  <th className="p-4 border-b">Código</th>
                  <th className="p-4 border-b">Cliente</th>
                  <th className="p-4 border-b">Estado Telegram</th>
                  <th className="p-4 border-b">Dictamen / Estado</th>
                  <th className="p-4 border-b text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {reclamos.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 border-b last:border-0">
                    <td className="p-4 text-sm">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-mono font-bold text-blue-600">
                      {r.codigo_erp}
                    </td>
                    <td className="p-4">
                      {r.nombre_cliente || 'Anónimo'}
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
                      {/* ETIQUETAS DE ESTADO */}
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
                      {/* BOTONES DE ACCIÓN */}
                      {r.estado !== 'CERRADO' && (
                        <>
                          <button
                            onClick={() => emitirDictamen(r.id, 'PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente, r.id_vendedor)}
                            className={`p-2 rounded shadow transition text-white 
                              ${r.dictamen === 'PROCEDE' ? 'bg-green-700 ring-2 ring-offset-1 ring-green-500' : 'bg-green-500 hover:bg-green-600'}
                            `}
                            title="Dictamen: PROCEDE"
                          >
                            ✅
                          </button>

                          <button
                            onClick={() => emitirDictamen(r.id, 'NO PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente, r.id_vendedor)}
                            className={`p-2 rounded shadow transition text-white 
                              ${r.dictamen === 'NO PROCEDE' ? 'bg-red-700 ring-2 ring-offset-1 ring-red-500' : 'bg-red-500 hover:bg-red-600'}
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