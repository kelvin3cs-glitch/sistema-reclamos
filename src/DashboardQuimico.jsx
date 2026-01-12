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
    // Seleccionamos TODAS las columnas (incluyendo las nuevas: dictamen, tipo_solucion)
    const { data, error } = await supabase
      .from('reclamos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error cargando reclamos:', error);
    else setReclamos(data);
    setLoading(false);
  };

  // 2. Función para EMITIR DICTAMEN (El Químico decide)
  const emitirDictamen = async (id, dictamen, codigo, chatIdCliente) => {
    // A. Confirmación visual
    if (!confirm(`¿Confirmas que el reclamo ${codigo} ${dictamen}?`)) return;

    // B. Actualizar BD:
    // - Guardamos el DICTAMEN (Opinión técnica)
    // - Cambiamos ESTADO a 'EN_GESTION' (Para que le aparezca al vendedor)
    const { error } = await supabase
      .from('reclamos')
      .update({
        dictamen: dictamen,       // 'PROCEDE' o 'NO PROCEDE'
        estado: 'EN_GESTION'      // Pasa a la cancha del vendedor
      })
      .eq('id', id);

    if (error) {
      console.error("Error BD:", error);
      alert('Error al guardar dictamen: ' + error.message);
      return;
    }

    // C. Notificar al Cliente (Telegram)
    if (chatIdCliente) {
      const mensaje = dictamen === 'PROCEDE'
        ? `✅ *¡BUENAS NOTICIAS!*\n\nTu reclamo *${codigo}* ha sido revisado y PROCEDE por garantía.\n\nNos pondremos en contacto contigo para coordinar la solución.`
        : `❌ *ACTUALIZACIÓN*\n\nTu reclamo *${codigo}* ha sido revisado y se determinó que NO PROCEDE.\n\nEl asesor te contactará para explicarte los detalles.`;

      try {
        await fetch('https://pdznmhuhblqvcypuiicn.supabase.co/functions/v1/telegram-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'NOTIFICAR_CLIENTE',
            chatId: chatIdCliente,
            mensaje: mensaje
          })
        });
        alert(`Dictamen guardado y cliente notificado! 📤`);
      } catch (err) {
        console.error(err);
        alert('Se guardó el dictamen, pero falló el envío a Telegram.');
      }
    } else {
      alert('Dictamen guardado (Sin Telegram vinculado).');
    }

    fetchReclamos(); // Recargar tabla
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
          👨‍🔬 Tablero de Control de Calidad
        </h1>

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
                      {/* LÓGICA DE ETIQUETAS INTELIGENTE */}
                      {r.dictamen ? (
                        // Si YA tiene dictamen, mostramos eso (Verde o Rojo)
                        <span className={`px-3 py-1 rounded-full text-xs font-bold
                          ${r.dictamen === 'PROCEDE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        `}>
                          {r.dictamen}
                        </span>
                      ) : (
                        // Si NO tiene dictamen, mostramos el estado (Pendiente)
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                          {r.estado}
                        </span>
                      )}
                      
                      {/* Si está cerrado, agregamos una marquita extra */}
                      {r.estado === 'CERRADO' && (
                        <span className="ml-2 text-xs text-gray-400 font-mono border px-1 rounded">
                          CERRADO
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      {/* Solo mostramos botones si NO está cerrado (o si queremos permitir corregir) */}
                      {r.estado !== 'CERRADO' && (
                        <>
                          <button
                            onClick={() => emitirDictamen(r.id, 'PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente)}
                            className={`p-2 rounded shadow transition text-white 
                              ${r.dictamen === 'PROCEDE' ? 'bg-green-700 ring-2 ring-offset-1 ring-green-500' : 'bg-green-500 hover:bg-green-600'}
                            `}
                            title="Dictamen: PROCEDE"
                          >
                            ✅
                          </button>

                          <button
                            onClick={() => emitirDictamen(r.id, 'NO PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente)}
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