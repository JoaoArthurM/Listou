import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[transform,background-color,box-shadow,opacity] duration-200 ease-saida active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Laranja da marca. O texto é escuro: branco não passa no contraste AA.
        default: 'bg-primary text-primary-foreground hover:brightness-105',
        dark: 'bg-foreground text-background hover:bg-foreground/90',
        // Contorno claro para usar em cima da moldura preta.
        moldura: 'border border-moldura-borda text-moldura-foreground hover:bg-moldura-cartao',
        secondary: 'border border-border bg-card text-foreground shadow-cartao hover:bg-muted',
        ghost: 'text-foreground hover:bg-foreground/5',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-105',
        link: 'rounded-md text-primary-texto underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-[1rem]',
        lg: 'h-12 px-6 text-[1rem]',
        sm: 'h-11 px-4 text-[0.875rem]',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
