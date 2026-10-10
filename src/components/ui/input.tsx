import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
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

/** Campo com rótulo visível, dica e mensagem de erro ligados ao input. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(({ label, hint, error, className, ...props }, ref) => {
  const id = useId()
  const descricao = error ? `${id}-erro` : hint ? `${id}-dica` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-medium">
        {label}
      </label>
      <Input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={descricao} {...props} />
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
})
Field.displayName = 'Field'
