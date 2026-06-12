import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import ExperimentDB from "./pages/ExperimentDB";
import DataJudgment from "./pages/DataJudgment";
import DeviceManage from "./pages/DeviceManage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="experiment-db" element={<ExperimentDB />} />
        <Route path="data-judgment" element={<DataJudgment />} />
        <Route path="device-manage" element={<DeviceManage />} />
      </Route>
    </Routes>
  );
}

export default App;
