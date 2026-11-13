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

// Panel del barbero (/me)
export type Agenda = components['schemas']['AgendaOut']
export type MeAppointment = components['schemas']['MeAppointmentOut']
export type DaySummary = components['schemas']['DaySummary']
export type ScheduleBlock = components['schemas']['ScheduleBlock']
export type ScheduleResult = components['schemas']['ScheduleOut']
export type Conflict = components['schemas']['ConflictOut']
export type TimeOff = components['schemas']['TimeOffOut']
export type TimeOffCreated = components['schemas']['TimeOffCreatedOut']
export type MeCreateAppointmentBody = components['schemas']['MeCreateAppointmentIn']

// Administración (/admin)
export type AdminService = components['schemas']['AdminServiceOut']
export type AdminServiceList = components['schemas']['AdminServiceListOut']
export type AdminResource = components['schemas']['ResourceOut']
export type ServiceCreateBody = components['schemas']['ServiceCreateIn']
export type ServicePatchBody = components['schemas']['ServicePatchIn']
