import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import RegistroReclamo from './RegistroReclamo';
import DashboardQuimico from './DashboardQuimico';
import MisReclamos from './MisReclamos';
import ConsultaReclamo from './ConsultaReclamo';
import AdminUsuarios from './AdminUsuarios'; // <--- 1. IMPORTAR
import { ProtectedRoute } from './ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/consulta" element={<ConsultaReclamo />} /> 

        {/* ZONA ADMIN (SISTEMAS) */}
        {/* Solo el ADMIN puede ver la gestión de usuarios */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
           <Route path="/usuarios" element={<AdminUsuarios />} />
        </Route>

        {/* ZONA QUIMICO Y ADMIN */}
        <Route element={<ProtectedRoute allowedRoles={['QUIMICO', 'ADMIN']} />}>
          <Route path="/admin" element={<DashboardQuimico />} />
        </Route>

        {/* ZONA VENDEDOR */}
        <Route element={<ProtectedRoute allowedRoles={['ASESOR_VENTAS']} />}>
          <Route path="/vendedor" element={<MisReclamos />} />
          <Route path="/nuevo-reclamo" element={<RegistroReclamo />} />
        </Route>

      </Routes>
    </Router>
  );
}

export default App;