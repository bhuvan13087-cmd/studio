
"use client"

import * as React from "react"
import { LayoutDashboard, Users, CreditCard, History, BarChart3, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { useRole } from "@/hooks/use-role"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'member'] },
  { title: "Members", url: "/members", icon: Users, roles: ['admin'] },
  { title: "Payments", url: "/payments", icon: CreditCard, roles: ['admin', 'member'] },
  { title: "Chit Rounds", url: "/rounds", icon: History, roles: ['admin', 'member'] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ['admin'] },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { role } = useRole()

  const handleLogout = async () => {
    await auth.signOut()
    router.push("/login")
  }

  const filteredNavItems = navItems.filter(item => item.roles.includes(role))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        {/* Branding removed from header per previous request */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-xs font-bold uppercase tracking-wider mb-4 opacity-60">
            ChitFund Console
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    size="lg"
                    className="transition-all duration-200 hover:bg-sidebar-accent/50"
                  >
                    <Link href={item.url} className="flex items-center gap-4">
                      <item.icon className="size-6 shrink-0" />
                      <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              tooltip="Logout" 
              size="lg"
              className="text-destructive-foreground hover:bg-destructive/10 h-14"
            >
              <LogOut className="size-6 text-destructive" />
              <span className="font-bold text-lg group-data-[collapsible=icon]:hidden text-destructive">
                Logout
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
