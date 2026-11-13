import type { SVGProps } from 'react'

// Iconos de trazo de 1.8 px, extremos redondeados, 24x24 (design-system/README.md, Iconografía).
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function Icon({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

export const CheckCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.5" />
  </Icon>
)

export const CrossCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
)

export const SpinnerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Icon>
)

export const UsersIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.8.6 2.7 2.2 3 4.6" />
  </Icon>
)

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Icon>
)

export const PlusCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Icon>
)

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)

export const BottleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 3h6v3H9zM8 6h8l1 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9z" />
    <path d="M7 13h10" />
  </Icon>
)

export const StoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M10 20v-6h4v6" />
  </Icon>
)
