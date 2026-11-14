import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from '../../app/layouts/AdminLayout'
import { NotFound } from '../../app/pages/NotFound'
import AgendaPage from './AgendaPage'
import BarbersPage from './BarbersPage'
import ClientsPage from './ClientsPage'
import OverviewPage from './OverviewPage'
import ProductsPage from './ProductsPage'
import ServicesPage from './ServicesPage'
import WeekPage from './WeekPage'

/** Área de administración: se carga con lazy() solo cuando alguien entra a /admin. */
export default function AdminArea() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="semana" element={<WeekPage />} />
        <Route path="servicios" element={<ServicesPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="barberos" element={<BarbersPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
