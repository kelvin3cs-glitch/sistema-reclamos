import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import QRCode from "react-qr-code"; // <--- 1. IMPORTAR LIBRERÍA
import { useNavigate } from 'react-router-dom'; // Para navegar

export default function RegistroReclamo() {
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const navigate = useNavigate();
  
  // ... (MANTÉN TUS ESTADOS DE FORMULARIO IGUAL QUE ANTES)
  const [formData, setFormData] = useState({
    codigoErp: '',
    dniCliente: '',
    nombreCliente: '',
    telefonoCliente: '',
    motivo: ''
  })
  const [busquedaVendedor, setBusquedaVendedor] = useState('')
  const [vendedoresEncontrados, setVendedoresEncontrados] = useState([])
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState(null)
  const [reclamoCreado, setReclamoCreado] = useState(null)

  // ... (MANTÉN EL useEffect DE AUTOCOMPLETADO IGUAL)
  useEffect(() => {
    const buscarVendedores = async () => {
      if (busquedaVendedor.length < 2) return setVendedoresEncontrados([])
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, email')
        .eq('rol', 'ASESOR_VENTAS')
        .ilike('nombre_completo', `%${busquedaVendedor}%`)
        .limit(5)
      if (!error && data) setVendedoresEncontrados(data)
    }
    const delay = setTimeout(buscarVendedores, 300)
    return () => clearTimeout(delay)
  }, [busquedaVendedor])

  // ... (MANTÉN EL handleSubmit IGUAL)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)
    try {
      if (!vendedorSeleccionado) throw new Error('Debes seleccionar un vendedor.')
      const { data: { user } } = await supabase.auth.getUser()
      const idUsuarioActual = user?.id || vendedorSeleccionado.id 
      const nuevoReclamo = {
        codigo_erp: formData.codigoErp.toUpperCase(),
        dni_ruc_cliente: formData.dniCliente,
        nombre_cliente: formData.nombreCliente,
        telefono_cliente: formData.telefonoCliente,
        motivo_reclamo: formData.motivo,
        id_quimico: idUsuarioActual, 
        id_vendedor: vendedorSeleccionado.id,
        estado: 'PENDIENTE'
      }
      const { data, error } = await supabase.from('reclamos').insert([nuevoReclamo]).select()
      if (error) throw error
      setReclamoCreado(data[0])
      setFormData({ codigoErp: '', dniCliente: '', nombreCliente: '', telefonoCliente: '', motivo: '' })
      setVendedorSeleccionado(null)
      setBusquedaVendedor('')
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    } finally {
      setLoading(false)
    }
  }

  // --- RENDERIZADO ACTUALIZADO CON QR ---
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
          <p className="text-gray-600 mb-4">Escanea para vincular:</p>
          
          {/* AQUÍ ESTÁ EL QR */}
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
        // ... (EL FORMULARIO SIGUE IGUAL)
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... COPIA TU FORMULARIO ANTERIOR AQUÍ (Inputs de Codigo, DNI, Vendedor, Motivo) ... */}
            {/* ... Por brevedad no lo repito, pero mantén tus inputs igual ... */}
             <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Código ERP</label>
              <input required type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: ABC001" 
                value={formData.codigoErp} onChange={e => setFormData({...formData, codigoErp: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">DNI / RUC</label>
              <input required type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1045..." 
                value={formData.dniCliente} onChange={e => setFormData({...formData, dniCliente: e.target.value})} />
            </div>
          </div>

          <div className="relative">
            <label className="text-sm font-semibold text-gray-700">Asignar Vendedor</label>
            {vendedorSeleccionado ? (
              <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-200 mt-1">
                <span className="font-bold text-green-800">{vendedorSeleccionado.nombre_completo}</span>
                <button type="button" onClick={() => {setVendedorSeleccionado(null); setBusquedaVendedor('')}} className="text-red-500 font-bold px-2">X</button>
              </div>
            ) : (
              <>
                <input type="text" className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Escribe 'Juan'..." 
                  value={busquedaVendedor} onChange={e => setBusquedaVendedor(e.target.value)} />
                {vendedoresEncontrados.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border mt-1 rounded shadow-xl max-h-40 overflow-y-auto">
                    {vendedoresEncontrados.map(v => (
                      <li key={v.id} onClick={() => {setVendedorSeleccionado(v); setVendedoresEncontrados([])}} className="p-2 hover:bg-blue-50 cursor-pointer border-b">
                        <div className="font-bold">{v.nombre_completo}</div>
                        <div className="text-xs text-gray-500">{v.email}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Motivo</label>
            <textarea className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-500 outline-none" rows="2" 
              value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})}></textarea>
          </div>

          <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
            {loading ? 'Guardando...' : 'Registrar Reclamo'}
          </button>
        </form>
      )}
    </div>
  )
}