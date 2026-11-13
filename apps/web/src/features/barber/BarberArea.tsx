import { Route, Routes } from 'react-router-dom'
import { BarberLayout } from '../../app/layouts/BarberLayout'
import { NotFound } from '../../app/pages/NotFound'
import { AgendaPage } from './AgendaPage'
import { NewAppointmentPage } from './NewAppointmentPage'
import { SchedulePage } from './SchedulePage'

/** Área del barbero: se carga con lazy() solo cuando alguien entra a /barbero. */
export default function BarberArea() {
  return (
    <Routes>
      <Route element={<BarberLayout />}>
        <Route index element={<AgendaPage />} />
        <Route path="nueva" element={<NewAppointmentPage />} />
        <Route path="horario" element={<SchedulePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
