import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function DashboardQuimico() {
  const [reclamos, setReclamos] = useState([]);
  const [nombresVendedores, setNombresVendedores] = useState({}); 
  const [loading, setLoading] = useState(true);

  // --- 1. ESTADOS PARA LOS FILTROS ---
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // Por defecto ver todo
  
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    
    // A. Traer Reclamos
    const { data: dataReclamos, error: errorReclamos } = await supabase
      .from('reclamos')
      .select('*')
      .order('created_at', { ascending: false });

    if (errorReclamos) console.error('Error reclamos:', errorReclamos);

    // B. Traer Vendedores
    const { data: dataPerfiles, error: errorPerfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo')
      // Opcional: Podríamos filtrar solo rol='ASESOR_VENTAS' si quisieras limpiar la lista
      // .eq('rol', 'ASESOR_VENTAS'); 

    if (errorPerfiles) console.error('Error perfiles:', errorPerfiles);

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

  const enviarNotificacionTelegram = async (chatId, mensaje) => {
    try {
      await fetch('https://pdznmhuhblqvcypuiicn.supabase.co/functions/v1/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NOTIFICAR_CLIENTE', chatId, mensaje })
      });
      return true;
    } catch (err) {
      console.error("Error enviando Telegram:", err);
      return false;
    }
  };

  const emitirDictamen = async (id, dictamen, codigo, chatIdCliente, idVendedor) => {
    if (!confirm(`¿Confirmas que el reclamo ${codigo} ${dictamen}?`)) return;

    const { error } = await supabase
      .from('reclamos')
      .update({ dictamen: dictamen, estado: 'EN_GESTION' })
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    let resumenNotificaciones = "Dictamen guardado. ✅";

    if (chatIdCliente) {
      const msjCliente = dictamen === 'PROCEDE'
        ? `✅ *¡BUENAS NOTICIAS!*\n\nTu reclamo *${codigo}* ha sido APROBADO por garantía.`
        : `❌ *ACTUALIZACIÓN*\n\nTu reclamo *${codigo}* NO PROCEDE según el análisis técnico.`;
      await enviarNotificacionTelegram(chatIdCliente, msjCliente);
      resumenNotificaciones += "\n- Cliente notificado 👤";
    }

    if (idVendedor) {
      const { data: vendedorData } = await supabase
        .from('perfiles')
        .select('telegram_chat_id')
        .eq('id', idVendedor)
        .single();

      if (vendedorData?.telegram_chat_id) {
        const msjVendedor = `🔔 *ATENCIÓN VENDEDOR*\n\nEl Químico dictaminó el reclamo *${codigo}*.\n\nDictamen: *${dictamen}*\n\n👉 Procede con el cierre administrativo.`;
        await enviarNotificacionTelegram(vendedorData.telegram_chat_id, msjVendedor);
        resumenNotificaciones += "\n- Vendedor notificado 👔";
      }
    }

    alert(resumenNotificaciones);
    cargarDatos();
  };

  // --- 2. LÓGICA DE FILTRADO (El Cerebro) ---
  const reclamosFiltrados = reclamos.filter(r => {
    // A. Filtro de Texto (Busca en Código o Cliente)
    const texto = textoBusqueda.toUpperCase();
    const coincideTexto = 
      r.codigo_erp.includes(texto) || 
      (r.nombre_cliente && r.nombre_cliente.toUpperCase().includes(texto));

    // B. Filtro de Vendedor
    const coincideVendedor = 
      filtroVendedor === 'TODOS' || 
      r.id_vendedor === filtroVendedor;

    // C. Filtro de Estado (Pendiente vs Listos)
    let coincideEstado = true;
    if (filtroEstado === 'PENDIENTES') {
      // Solo mostramos los que NO tienen dictamen aún
      coincideEstado = !r.dictamen; 
    } else if (filtroEstado === 'LISTOS') {
      coincideEstado = !!r.dictamen; // Tienen dictamen (Procede/No procede)
    }

    return coincideTexto && coincideVendedor && coincideEstado;
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            👨‍🔬 Tablero de Control de Calidad
          </h1>
          
          <button 
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              const { data } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
              if (data && data.rol === 'ADMIN') window.location.href = '/usuarios';
              else alert('⛔ Acceso denegado.');
            }}
            className="text-sm text-gray-500 hover:text-blue-600 underline font-medium transition"
          >
            ⚙️ Gestión Usuarios
          </button>
        </div>

        {/* --- 3. BARRA DE HERRAMIENTAS (NUEVO) --- */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-wrap gap-4 items-end border border-gray-200">
          
          {/* Buscador */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-500 mb-1">BUSCAR (CÓDIGO / CLIENTE)</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ej: TEST-001 o Erick"
                className="w-full border p-2 pl-8 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                value={textoBusqueda}
                onChange={e => setTextoBusqueda(e.target.value)}
              />
              <span className="absolute left-2 top-2 text-gray-400">🔍</span>
            </div>
          </div>

          {/* Filtro Vendedor */}
          <div className="w-full sm:w-64">
             <label className="block text-xs font-bold text-gray-500 mb-1">FILTRAR POR VENDEDOR</label>
             <select 
               className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
               value={filtroVendedor}
               onChange={e => setFiltroVendedor(e.target.value)}
             >
               <option value="TODOS">🧑‍💼 Todos los Vendedores</option>
               {/* Generamos las opciones dinámicamente desde el diccionario de nombres */}
               {Object.keys(nombresVendedores).map(id => (
                 <option key={id} value={id}>
                   {nombresVendedores[id]}
                 </option>
               ))}
             </select>
          </div>

          {/* Filtro Estado */}
          <div className="w-full sm:w-48">
             <label className="block text-xs font-bold text-gray-500 mb-1">ESTADO / TAREA</label>
             <select 
               className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
               value={filtroEstado}
               onChange={e => setFiltroEstado(e.target.value)}
             >
               <option value="TODOS">📊 Ver Todo</option>
               <option value="PENDIENTES">⏳ Solo Pendientes</option>
               <option value="LISTOS">✅ Ya Dictaminados</option>
             </select>
          </div>
          
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
                  <th className="p-4 border-b text-blue-800 bg-blue-50">Vendedor</th> 
                  <th className="p-4 border-b">Estado Telegram</th>
                  <th className="p-4 border-b">Dictamen / Estado</th>
                  <th className="p-4 border-b text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 text-sm">
                {/* OJO: Aquí iteramos sobre 'reclamosFiltrados', no sobre 'reclamos' */}
                {reclamosFiltrados.length > 0 ? (
                  reclamosFiltrados.map((r) => (
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
                  ))
                ) : (
                  // Si no hay resultados con los filtros
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500 italic">
                      No se encontraron reclamos con estos filtros. 🕵️‍♂️
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}