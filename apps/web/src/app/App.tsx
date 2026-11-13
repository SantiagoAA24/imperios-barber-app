import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Login } from '../features/auth/Login'
import { PublicLayout } from './layouts/PublicLayout'
import { ComingSoon } from './pages/ComingSoon'
import { NotFound } from './pages/NotFound'
import { Offline } from './pages/Offline'
import { Privacy } from './pages/Privacy'
import { Providers } from './providers'
import { RouteBoundary } from './RouteBoundary'
import { RutaProtegida } from './RutaProtegida'

// Las áreas de personal viajan en sus propios chunks (arquitectura.md §7).
const BarberArea = lazy(() => import('../features/barber/BarberArea'))
const AdminArea = lazy(() => import('../features/admin/AdminArea'))
// Solo en desarrollo: en producción el import queda fuera del bundle.
const UiGallery = import.meta.env.DEV ? lazy(() => import('../features/dev/UiGallery')) : null

function Loading() {
  return (
    <p role="status" className="m-0 px-20 py-36 text-body text-text-muted">
      Cargando…
    </p>
  )
}

function Area({ role, children }: { role: 'barber' | 'admin'; children: React.ReactNode }) {
  return (
    <RutaProtegida role={role}>
      <RouteBoundary>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </RouteBoundary>
    </RutaProtegida>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<ComingSoon name="Agendar" />} />
        <Route path="cita/:token" element={<ComingSoon name="Tu cita" />} />
        <Route path="productos" element={<ComingSoon name="Productos" />} />
        <Route path="ingresar" element={<Login />} />
        <Route path="privacidad" element={<Privacy />} />
        <Route path="offline" element={<Offline />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {UiGallery && (
        <Route
          path="ui"
          element={
            <Suspense fallback={<Loading />}>
              <UiGallery />
            </Suspense>
          }
        />
      )}
      <Route
        path="barbero/*"
        element={
          <Area role="barber">
            <BarberArea />
          </Area>
        }
      />
      <Route
        path="admin/*"
        element={
          <Area role="admin">
            <AdminArea />
          </Area>
        }
      />
    </Routes>
  )
}

export function App() {
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  )
}
