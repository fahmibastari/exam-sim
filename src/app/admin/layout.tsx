import AdminNav from './_components/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminNav />
      <main className="max-w-5xl mx-auto px-4">{children}</main>
    </div>
  )
}
