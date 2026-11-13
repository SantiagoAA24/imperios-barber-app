import { Outlet } from 'react-router-dom'

/** Columna máxima de 480 px, centrada, sobre --color-bg. */
export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto min-h-dvh w-full max-w-[480px]">
        <Outlet />
      </div>
    </div>
  )
}
