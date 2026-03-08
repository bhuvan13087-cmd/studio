
"use client"

import * as React from "react"
import { LayoutDashboard, Users, CreditCard, History, BarChart3, LogOut, ShieldCheck } from "lucide-react"
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
  const { role, isLoading } = useRole()

  const handleLogout = async () => {
    await auth.signOut()
    router.push("/login")
  }

  const filteredNavItems = navItems.filter(item => item.roles.includes(role))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-headline font-bold text-lg tracking-tight">ChitFund Pro</span>
            <span className="text-xs text-sidebar-foreground/60">
              {isLoading ? "Loading..." : role === 'admin' ? "Admin Console" : "Member Portal"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="transition-all duration-200"
                  >
                    <Link href={item.url}>
                      <item.icon className="size-5" />
                      <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
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
              className="text-destructive-foreground hover:bg-destructive/10"
            >
              <LogOut className="size-5 text-destructive" />
              <span className="font-medium group-data-[collapsible=icon]:hidden text-destructive">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
