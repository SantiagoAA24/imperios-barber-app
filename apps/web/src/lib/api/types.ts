import type { components } from './schema'

// Todos los tipos salen del OpenAPI generado (make types); nada se duplica a mano.
export type Business = components['schemas']['PublicBusiness']
export type Service = components['schemas']['PublicService']
export type Barber = components['schemas']['PublicBarber']
export type Product = components['schemas']['PublicProduct']
export type SessionUser = components['schemas']['UserOut']
export type UserRole = components['schemas']['UserRole']
