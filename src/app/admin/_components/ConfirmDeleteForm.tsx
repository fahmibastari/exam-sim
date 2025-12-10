// src/app/admin/_components/ConfirmDeleteForm.tsx
'use client'

import { FormEvent, ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

type Props = {
    action: (formData: FormData) => Promise<void>
    id: string
    confirmationMessage?: string
    children?: ReactNode
    className?: string
}

export default function ConfirmDeleteForm({
    action,
    id,
    confirmationMessage = 'Apakah Anda yakin ingin menghapus item ini?',
    children,
    className
}: Props) {
    return (
        <form
            action={action}
            onSubmit={(e: FormEvent) => {
                if (!confirm(confirmationMessage)) {
                    e.preventDefault()
                }
            }}
            className={className}
        >
            <input type="hidden" name="id" value={id} />
            {children || (
                <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 shadow-sm hover:bg-red-50 hover:border-red-300">
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
        </form>
    )
}
