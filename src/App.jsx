import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import RegistroReclamo from './RegistroReclamo';
import DashboardQuimico from './DashboardQuimico';
import MisReclamos from './MisReclamos';
import ConsultaReclamo from './ConsultaReclamo';
import { ProtectedRoute } from './ProtectedRoute'; // <--- 1. IMPORTAMOS EL GUARDAESPALDAS

function App() {
  return (
    <Router>
      <Routes>
        {/* RUTES PÚBLICAS (Cualquiera entra) */}
        <Route path="/" element={<Login />} />
        <Route path="/consulta" element={<ConsultaReclamo />} /> 

        {/* 🔐 ZONA PROHIBIDA: SOLO QUÍMICOS */}
        <Route element={<ProtectedRoute allowedRoles={['QUIMICO', 'ADMIN']} />}>
          <Route path="/admin" element={<DashboardQuimico />} />
        </Route>

        {/* 🔐 ZONA PROHIBIDA: SOLO VENDEDORES */}
        <Route element={<ProtectedRoute allowedRoles={['ASESOR_VENTAS']} />}>
          <Route path="/vendedor" element={<MisReclamos />} />
          <Route path="/nuevo-reclamo" element={<RegistroReclamo />} />
        </Route>

      </Routes>
    </Router>
  );
}

export default App;