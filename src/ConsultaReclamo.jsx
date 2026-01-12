import { useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function ConsultaReclamo() {
  const [codigo, setCodigo] = useState('');
  const [reclamo, setReclamo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const buscarReclamo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReclamo(null);

    const { data, error } = await supabase
      .from('reclamos')
      .select('codigo_erp, estado, dictamen, created_at, tipo_solucion, sustento_cierre')
      .eq('codigo_erp', codigo.toUpperCase().trim())
      .maybeSingle();

    if (error) {
      setError('Error al buscar. Inténtalo de nuevo.');
    } else if (!data) {
      setError('No encontramos ningún reclamo con ese código.');
    } else {
      setReclamo(data);
    }
    setLoading(false);
  };

  // --- LÓGICA DE MENSAJES AMIGABLES ---
  const getInfoEstado = () => {
    if (!reclamo) return {};

    // CASO 1: Recién creado
    if (reclamo.estado === 'PENDIENTE') {
      return {
        titulo: '📅 Reclamo Recibido',
        descripcion: 'Tu caso ya está en nuestro sistema. El equipo de Calidad (Laboratorio) lo revisará en breve para determinar si procede la garantía.',
        color: 'bg-blue-50 border-blue-200 text-blue-800',
        icono: '🧪'
      };
    }

    // CASO 2: El Químico ya revisó, falta que el Vendedor cierre
    if (reclamo.estado === 'EN_GESTION') {
      if (reclamo.dictamen === 'PROCEDE') {
        return {
          titulo: '✅ Aprobado por Calidad',
          descripcion: '¡Buenas noticias! El laboratorio confirmó la falla. Un asesor comercial está procesando tu cambio o nota de crédito. Te contactaremos pronto.',
          color: 'bg-green-50 border-green-200 text-green-800',
          icono: '🎉'
        };
      } else if (reclamo.dictamen === 'NO PROCEDE') {
        return {
          titulo: '🔍 Análisis Terminado',
          descripcion: 'El laboratorio ha revisado tu producto. Lamentablemente, el dictamen preliminar indica que no aplica la garantía. Un asesor te contactará para explicarte los detalles.',
          color: 'bg-orange-50 border-orange-200 text-orange-800',
          icono: '📋'
        };
      }
    }

    // CASO 3: Cerrado Definitivamente
    if (reclamo.estado === 'CERRADO') {
      if (reclamo.dictamen === 'PROCEDE') {
        return {
          titulo: '✨ Caso Solucionado',
          descripcion: `Se aplicó la solución: ${reclamo.tipo_solucion?.replace('_', ' ')}. Gracias por tu paciencia.`,
          color: 'bg-green-100 border-green-300 text-green-900',
          icono: '🤝'
        };
      } else {
        return {
          titulo: '❌ Reclamo Cerrado',
          descripcion: 'El reclamo fue rechazado definitivamente tras la evaluación técnica y comercial.',
          color: 'bg-gray-100 border-gray-300 text-gray-800',
          icono: '🔒'
        };
      }
    }

    return { titulo: 'Desconocido', descripcion: '', color: 'gray' };
  };

  const info = getInfoEstado();

  // --- LÓGICA VISUAL DE LA LÍNEA DE TIEMPO ---
  const getStepColor = (step) => {
    if (!reclamo) return 'bg-gray-200 text-gray-400';
    
    // Paso 1: Recepción
    if (step === 1) return 'bg-blue-600 text-white';

    // Paso 2: Análisis
    if (step === 2) {
      if (reclamo.estado === 'PENDIENTE') return 'bg-gray-200 text-gray-400';
      if (reclamo.dictamen === 'NO PROCEDE') return 'bg-orange-500 text-white'; // Naranja para alerta
      return 'bg-blue-600 text-white'; // Azul para ok
    }

    // Paso 3: Resolución
    if (step === 3) {
      if (reclamo.estado !== 'CERRADO') return 'bg-gray-200 text-gray-400';
      if (reclamo.dictamen === 'NO PROCEDE') return 'bg-gray-600 text-white'; // Gris oscuro para rechazo
      return 'bg-green-600 text-white'; // Verde para éxito final
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        
        {/* Cabecera */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 flex justify-center items-center gap-2">
            🔍 Rastrea tu Reclamo
          </h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa el código que te dio el vendedor</p>
        </div>

        {/* Buscador */}
        <form onSubmit={buscarReclamo} className="flex gap-2 mb-8">
          <input
            type="text"
            placeholder="Ej: PROD-FALLA-002"
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase text-center tracking-widest"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button 
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md"
          >
            {loading ? '...' : 'Ver'}
          </button>
        </form>

        {/* Mensaje de Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-6 border border-red-100 animate-pulse">
            {error}
          </div>
        )}

        {/* RESULTADOS */}
        {reclamo && (
          <div className="animate-fade-in-up">
            
            {/* 1. LÍNEA DE TIEMPO MEJORADA */}
            <div className="relative flex justify-between mb-8 px-2">
              <div className="absolute top-4 left-0 w-full h-1 bg-gray-100 -z-10"></div>
              
              {/* Paso 1 */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors duration-500 ${getStepColor(1)}`}>
                  1
                </div>
                <span className="text-xs font-semibold text-gray-600">Recibido</span>
              </div>

              {/* Paso 2 */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors duration-500 ${getStepColor(2)}`}>
                  2
                </div>
                <span className="text-xs font-semibold text-gray-600">
                  {reclamo.dictamen ? (reclamo.dictamen === 'PROCEDE' ? 'Aprobado' : 'Observado') : 'Análisis'}
                </span>
              </div>

              {/* Paso 3 */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors duration-500 ${getStepColor(3)}`}>
                  3
                </div>
                <span className="text-xs font-semibold text-gray-600">Resolución</span>
              </div>
            </div>

            {/* 2. TARJETA EXPLICATIVA (El corazón de la mejora) */}
            <div className={`p-6 rounded-xl border-l-4 shadow-sm mb-6 ${info.color}`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{info.icono}</span>
                <div>
                  <h3 className="font-bold text-lg mb-1">{info.titulo}</h3>
                  <p className="text-sm opacity-90 leading-relaxed">
                    {info.descripcion}
                  </p>
                </div>
              </div>
              
              {/* Si está cerrado y hay sustento, lo mostramos aparte */}
              {reclamo.sustento_cierre && (
                <div className="mt-4 pt-3 border-t border-black/10 text-xs italic opacity-75">
                  Nota del vendedor: "{reclamo.sustento_cierre}"
                </div>
              )}
            </div>

          </div>
        )}
        
        <div className="mt-8 text-center border-t pt-4">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-blue-500 text-sm transition">
            ← Soy Personal Interno
          </button>
        </div>
      </div>
    </div>
  );
}