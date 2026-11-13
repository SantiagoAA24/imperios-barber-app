import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'

expect.extend(axeMatchers)
afterEach(cleanup)

// jsdom no implementa scrollIntoView ni matchMedia: la app solo los usa para desplazar y para
// leer prefers-reduced-motion, y aquí basta con que no lancen error.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
