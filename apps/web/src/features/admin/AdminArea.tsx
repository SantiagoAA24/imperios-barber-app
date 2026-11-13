import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from '../../app/layouts/AdminLayout'
import { ComingSoon } from '../../app/pages/ComingSoon'
import { NotFound } from '../../app/pages/NotFound'

/** Área de administración: se carga con lazy() solo cuando alguien entra a /admin. */
export default function AdminArea() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<ComingSoon name="Resumen" />} />
        <Route path="agenda" element={<ComingSoon name="Agenda por día" />} />
        <Route path="semana" element={<ComingSoon name="Agenda por semana" />} />
        <Route path="servicios" element={<ComingSoon name="Servicios" />} />
        <Route path="productos" element={<ComingSoon name="Productos" />} />
        <Route path="barberos" element={<ComingSoon name="Barberos" />} />
        <Route path="clientes" element={<ComingSoon name="Clientes" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
