'use client'

import { useRef } from 'react'

type Props = {
    action: (formData: FormData) => Promise<any>
    children: React.ReactNode
    className?: string
    successMessage?: string
    onSuccess?: () => void
}

export default function ClientActionForm({ action, children, className, successMessage, onSuccess }: Props) {
    const formRef = useRef<HTMLFormElement>(null)

    async function handleSubmit(formData: FormData) {
        try {
            // Call server action
            const result = await action(formData)

            // Handle structured error response if exists
            if (result && result.error) {
                alert(result.error)
                return
            }

            // Success
            if (successMessage) alert(successMessage)
            formRef.current?.reset()
            if (onSuccess) onSuccess()

        } catch (err: any) {
            console.error(err)
            // Fallback for unhandled server errors
            alert(err.message || 'Terjadi kesalahan sistem')
        }
    }

    return (
        <form
            ref={formRef}
            action={handleSubmit}
            className={className}
        >
            {children}
        </form>
    )
}
