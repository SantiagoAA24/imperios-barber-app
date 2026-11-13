import { Route, Routes } from 'react-router-dom'
import { BarberLayout } from '../../app/layouts/BarberLayout'
import { ComingSoon } from '../../app/pages/ComingSoon'
import { NotFound } from '../../app/pages/NotFound'

/** Área del barbero: se carga con lazy() solo cuando alguien entra a /barbero. */
export default function BarberArea() {
  return (
    <Routes>
      <Route element={<BarberLayout />}>
        <Route index element={<ComingSoon name="Agenda del día" />} />
        <Route path="nueva" element={<ComingSoon name="Nueva cita" />} />
        <Route path="horario" element={<ComingSoon name="Mi horario" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
