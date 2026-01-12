import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import RegistroReclamo from './RegistroReclamo';
import DashboardQuimico from './DashboardQuimico';
import MisReclamos from './MisReclamos';
import ConsultaReclamo from './ConsultaReclamo'; // <--- 1. IMPORTAR

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<DashboardQuimico />} />
        <Route path="/vendedor" element={<MisReclamos />} />
        <Route path="/nuevo-reclamo" element={<RegistroReclamo />} />
        
        {/* 2. RUTA PÚBLICA PARA CLIENTES */}
        <Route path="/consulta" element={<ConsultaReclamo />} /> 
      </Routes>
    </Router>
  );
}

export default App;