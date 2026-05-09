import { createClient } from "@/lib/supabase/server"
import DashboardClient from "@/components/dashboard/dashboard-client"
import { DashboardProvider } from "@/context/dashboard-context"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  return (
    <DashboardProvider>
      <DashboardClient user={user} />
    </DashboardProvider>
  )
}
