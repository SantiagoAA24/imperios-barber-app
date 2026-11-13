import type { components } from './schema'

// Todos los tipos salen del OpenAPI generado (make types); nada se duplica a mano.
export type Business = components['schemas']['PublicBusiness']
export type Service = components['schemas']['PublicService']
export type Barber = components['schemas']['PublicBarber']
export type Product = components['schemas']['PublicProduct']
export type SessionUser = components['schemas']['UserOut']
export type UserRole = components['schemas']['UserRole']
export type PublicAppointment = components['schemas']['PublicAppointment']
export type AppointmentStatus = components['schemas']['AppointmentStatus']
export type CreateAppointmentBody = components['schemas']['CreateAppointmentIn']
export type CreatedAppointment = components['schemas']['CreatedAppointment']
export type Slot = components['schemas']['SlotOut']
