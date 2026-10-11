import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-12 w-full rounded-campo border border-controle/70 bg-card px-4 text-foreground transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50 aria-[invalid=true]:border-destructive',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string | null
}

// Rótulo visível, dica e mensagem de erro, ligados ao campo pelos ids.
function Moldura({ id, label, hint, error, className, children }: Pick<FieldProps, 'label' | 'hint' | 'error' | 'className'> & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.875rem] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-dica`} className="mt-1.5 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const descritoPor = (id: string, { hint, error }: Pick<FieldProps, 'hint' | 'error'>) =>
  error ? `${id}-erro` : hint ? `${id}-dica` : undefined

/** Campo com rótulo visível, dica e mensagem de erro ligados ao input. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(({ label, hint, error, className, ...props }, ref) => {
  const id = useId()
  return (
    <Moldura id={id} label={label} hint={hint} error={error} className={className}>
      <Input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={descritoPor(id, { hint, error })} {...props} />
    </Moldura>
  )
})
Field.displayName = 'Field'

/** Campo de senha com o botão de mostrar ou esconder o que foi digitado. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, 'type'>>(
  ({ label, hint, error, className, ...props }, ref) => {
    const id = useId()
    const [visivel, setVisivel] = useState(false)
    const Icone = visivel ? EyeOff : Eye
    return (
      <Moldura id={id} label={label} hint={hint} error={error} className={className}>
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            type={visivel ? 'text' : 'password'}
            className="pr-12"
            aria-invalid={error ? true : undefined}
            aria-describedby={descritoPor(id, { hint, error })}
            {...props}
          />
          <button
            type="button"
            aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}
            aria-pressed={visivel}
            onClick={() => setVisivel((v) => !v)}
            className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground"
          >
            <Icone aria-hidden className="size-5" />
          </button>
        </div>
      </Moldura>
    )
  },
)
PasswordField.displayName = 'PasswordField'
