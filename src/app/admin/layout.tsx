import AdminNav from './_components/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50/50">
      <AdminNav />
      <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
        {children}
      </main>
    </div>
  )
}
