
"use client"

import * as React from "react"
import { LayoutDashboard, Users, CreditCard, History, BarChart3, LogOut, CalendarClock, FastForward, Loader2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { useRole } from "@/hooks/use-role"
import { useToast } from "@/hooks/use-toast"

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
  useSidebar,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'member'] },
  { title: "Cycles", url: "/cycles", icon: CalendarClock, roles: ['admin'] },
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
  const { isMobile, setOpenMobile } = useSidebar()
  const { toast } = useToast()
  const [isShifting, setIsShifting] = React.useState(false)

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleLogout = async () => {
    if (isMobile) {
      setOpenMobile(false)
    }
    await auth.signOut()
    router.push("/login")
  }

  const handleDateShift = async () => {
    if (isShifting) return;
    if (!confirm("Are you sure you want to manually shift the system date to the next day? This is a one-time administrative action.")) return;
    
    setIsShifting(true);
    try {
      const res = await fetch('/api/system/shift-date');
      const data = await res.json();
      if (data.success) {
        toast({ title: "System Shifted", description: data.message });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Shift Failed", description: error.message });
    } finally {
      setIsShifting(false);
    }
  }

  const filteredNavItems = navItems.filter(item => item.roles.includes(role))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-xs font-bold uppercase tracking-wider mb-4 opacity-60">
            Admin Menu
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
                    <Link 
                      href={item.url} 
                      onClick={handleLinkClick}
                      className="flex items-center gap-4"
                    >
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
          {role === 'admin' && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={handleDateShift}
                tooltip="Manual Day Shift" 
                size="lg"
                className="hover:bg-primary/10 h-14"
                disabled={isShifting}
              >
                {isShifting ? <Loader2 className="size-6 animate-spin text-primary" /> : <FastForward className="size-6 text-primary" />}
                <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
                  Shift Day
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
