import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function DashboardQuimico() {
  const [reclamos, setReclamos] = useState([]);
  const [nombresVendedores, setNombresVendedores] = useState({}); 
  const [loading, setLoading] = useState(true);

  // --- 1. ESTADOS PARA LOS FILTROS ---
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); 
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // --- Paginación ---
  const [paginaActual, setPaginaActual] = useState(1);
  const ELEMENTOS_POR_PAGINA = 10; 

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [textoBusqueda, filtroVendedor, filtroEstado, fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    setLoading(true);
    
    // A. Traer Reclamos
    const { data: dataReclamos, error: errorReclamos } = await supabase
      .from('reclamos')
      .select('*')
      .order('created_at', { ascending: false });

    if (errorReclamos) console.error('Error reclamos:', errorReclamos);

    // B. Traer SOLO VENDEDORES
    const { data: dataPerfiles, error: errorPerfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo')
      .eq('rol', 'ASESOR_VENTAS');

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

  // --- 2. LÓGICA DE FILTRADO ---
  const reclamosFiltrados = reclamos.filter(r => {
    // A. Texto
    const texto = textoBusqueda.toUpperCase();
    const coincideTexto = 
      r.codigo_erp.includes(texto) || 
      (r.nombre_cliente && r.nombre_cliente.toUpperCase().includes(texto));

    // B. Vendedor
    const coincideVendedor = 
      filtroVendedor === 'TODOS' || 
      r.id_vendedor === filtroVendedor;

    // C. Estado
    let coincideEstado = true;
    if (filtroEstado === 'PENDIENTES') coincideEstado = !r.dictamen; 
    else if (filtroEstado === 'LISTOS') coincideEstado = !!r.dictamen;

    // D. Fechas
    let coincideFecha = true;
    if (fechaInicio) {
      const fechaItem = new Date(r.created_at).toISOString().split('T')[0];
      if (fechaItem < fechaInicio) coincideFecha = false;
    }
    if (fechaFin) {
      const fechaItem = new Date(r.created_at).toISOString().split('T')[0];
      if (fechaItem > fechaFin) coincideFecha = false;
    }

    return coincideTexto && coincideVendedor && coincideEstado && coincideFecha;
  });

  // --- 3. PAGINACIÓN ---
  const indiceUltimoElemento = paginaActual * ELEMENTOS_POR_PAGINA;
  const indicePrimerElemento = indiceUltimoElemento - ELEMENTOS_POR_PAGINA;
  const reclamosPaginados = reclamosFiltrados.slice(indicePrimerElemento, indiceUltimoElemento);
  const totalPaginas = Math.ceil(reclamosFiltrados.length / ELEMENTOS_POR_PAGINA);
  const cambiarPagina = (n) => setPaginaActual(n);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto"> {/* Hice el contenedor más ancho para que quepa todo */}
        
        {/* Cabecera */}
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

        {/* --- BARRA DE HERRAMIENTAS COMPACTA --- */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-200">
          <div className="flex flex-wrap items-end gap-3">
            
            {/* 1. Buscador (Ancho Reducido) */}
            <div className="w-full sm:w-48 md:w-56"> 
              <label className="block text-[10px] font-bold text-gray-500 mb-1">BUSCAR</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="CÓDIGO / CLIENTE"
                  className="w-full border border-gray-300 p-2 pl-7 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  value={textoBusqueda}
                  onChange={e => setTextoBusqueda(e.target.value)}
                />
                <span className="absolute left-2 top-2 text-gray-400 text-xs">🔍</span>
              </div>
            </div>

            {/* 2. Filtro Vendedor */}
            <div className="w-full sm:w-48 md:w-52">
               <label className="block text-[10px] font-bold text-gray-500 mb-1">VENDEDOR</label>
               <select 
                 className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                 value={filtroVendedor}
                 onChange={e => setFiltroVendedor(e.target.value)}
               >
                 <option value="TODOS">Todos</option>
                 {Object.keys(nombresVendedores).map(id => (
                   <option key={id} value={id}>
                     {nombresVendedores[id]}
                   </option>
                 ))}
               </select>
            </div>

            {/* 3. Filtro Estado */}
            <div className="w-full sm:w-32 md:w-40">
               <label className="block text-[10px] font-bold text-gray-500 mb-1">ESTADO</label>
               <select 
                 className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                 value={filtroEstado}
                 onChange={e => setFiltroEstado(e.target.value)}
               >
                 <option value="TODOS">Ver Todo</option>
                 <option value="PENDIENTES">⏳ Pendientes</option>
                 <option value="LISTOS">✅ Listos</option>
               </select>
            </div>

            {/* 4. Fecha Desde */}
            <div className="w-full sm:w-32 md:w-36">
               <label className="block text-[10px] font-bold text-gray-500 mb-1">DESDE</label>
               <input 
                  type="date" 
                  className="border border-gray-300 p-2 rounded w-full text-sm focus:ring-1 focus:ring-blue-500"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
               />
            </div>

            {/* 5. Fecha Hasta */}
            <div className="w-full sm:w-32 md:w-36">
               <label className="block text-[10px] font-bold text-gray-500 mb-1">HASTA</label>
               <input 
                  type="date" 
                  className="border border-gray-300 p-2 rounded w-full text-sm focus:ring-1 focus:ring-blue-500"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
               />
            </div>

            {/* Botón Limpiar Fechas (Pequeño) */}
            {(fechaInicio || fechaFin) && (
               <button 
                 onClick={() => { setFechaInicio(''); setFechaFin(''); }}
                 className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-2 py-2 rounded border border-red-100"
                 title="Borrar filtro de fechas"
               >
                 ✖
               </button>
             )}

          </div>
        </div>

        {/* --- TABLA --- */}
        {loading ? (
          <p className="text-center text-gray-500">Cargando reclamos...</p>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden flex flex-col min-h-[500px]"> 
            <div className="overflow-x-auto flex-grow">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-200 text-gray-700 uppercase text-xs">
                  <tr>
                    <th className="p-4 border-b">Fecha</th>
                    <th className="p-4 border-b">Código</th>
                    <th className="p-4 border-b">Cliente</th>
                    <th className="p-4 border-b text-blue-800 bg-blue-50">Vendedor</th> 
                    <th className="p-4 border-b">Telegram</th>
                    <th className="p-4 border-b">Estado</th>
                    <th className="p-4 border-b text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 text-sm">
                  {reclamosPaginados.length > 0 ? (
                    reclamosPaginados.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 border-b last:border-0">
                        <td className="p-4 whitespace-nowrap">
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
                               👤 {nombresVendedores[r.id_vendedor].split(' ')[0]} {/* Solo primer nombre para ahorrar espacio */}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">--</span>
                          )}
                        </td>
                        <td className="p-4">
                          {r.telegram_chat_id_cliente ? (
                            <span className="text-green-600 text-lg" title="Vinculado">📱</span>
                          ) : (
                            <span className="text-gray-300 text-lg" title="Pendiente">📱</span>
                          )}
                        </td>
                        <td className="p-4">
                          {r.dictamen ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold border
                              ${r.dictamen === 'PROCEDE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
                            `}>
                              {r.dictamen}
                            </span>
                          ) : (
                            <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200">
                              PENDIENTE
                            </span>
                          )}
                           {r.estado === 'CERRADO' && (
                            <span className="ml-2 text-[10px] text-gray-400 font-mono border px-1 rounded bg-gray-50">
                              CERRADO
                            </span>
                          )}
                        </td>
                        <td className="p-4 flex justify-center gap-2">
                          {r.estado !== 'CERRADO' && (
                            <>
                              <button
                                onClick={() => emitirDictamen(r.id, 'PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente, r.id_vendedor)}
                                className={`p-1.5 rounded shadow transition text-white 
                                  ${r.dictamen === 'PROCEDE' ? 'bg-green-700' : 'bg-green-500 hover:bg-green-600'}
                                `}
                                title="Aprobar"
                              >
                                ✅
                              </button>

                              <button
                                onClick={() => emitirDictamen(r.id, 'NO PROCEDE', r.codigo_erp, r.telegram_chat_id_cliente, r.id_vendedor)}
                                className={`p-1.5 rounded shadow transition text-white 
                                  ${r.dictamen === 'NO PROCEDE' ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}
                                `}
                                title="Rechazar"
                              >
                                ❌
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-500 italic">
                        No se encontraron resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* --- CONTROLES DE PAGINACIÓN --- */}
            {totalPaginas > 1 && (
              <div className="bg-gray-50 border-t p-4 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                   Página {paginaActual} de {totalPaginas}
                </span>
                
                <div className="flex gap-1">
                  <button 
                    onClick={() => cambiarPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className={`px-3 py-1 rounded border text-xs font-bold 
                      ${paginaActual === 1 ? 'bg-gray-100 text-gray-300' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
                  >
                    ◀
                  </button>

                  {[...Array(totalPaginas)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => cambiarPagina(i + 1)}
                      className={`px-3 py-1 rounded border text-xs font-bold
                        ${paginaActual === i + 1 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white hover:bg-gray-100 text-gray-700'}`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button 
                    onClick={() => cambiarPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className={`px-3 py-1 rounded border text-xs font-bold 
                      ${paginaActual === totalPaginas ? 'bg-gray-100 text-gray-300' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
                  >
                    ▶
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}