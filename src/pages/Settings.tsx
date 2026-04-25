import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Settings as SettingsIcon,
  User,
  Globe,
  Save,
  Upload,
  LogOut,
  Printer,
  Lock,
} from "lucide-react"
import { toast } from "sonner"
import {
  loadPrintPrinterConfig,
  savePrintPrinterConfig,
  type PrintBackend,
  type PrintPrinterConfig,
} from "@/lib/printConfig"

const Settings = () => {
  const navigate = useNavigate()
  const [printCfg, setPrintCfg] = useState<PrintPrinterConfig>(() => loadPrintPrinterConfig())
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  const [userDetailsLoading, setUserDetailsLoading] = useState(false)
  const [userDetailsUpdating, setUserDetailsUpdating] = useState(false)
  const [personalInfo, setPersonalInfo] = useState({
    username: "",
    fullName: "",
    email: "",
    phoneNumber: "",
    role: "",
  })
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Fetch user details
  const fetchUserDetails = async (isLoading = true) => {
    if (isLoading) setUserDetailsLoading(true)
    try {
      const response = await fetch("http://localhost:8080/api/security/user/details", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch user details")
      }

      const data = await response.json()
      setPersonalInfo({
        username: data.username || "",
        fullName: data.fullName || "",
        email: data.email || "",
        phoneNumber: data.phoneNumber || "",
        role: data.role || "",
      })
    } catch (error) {
      console.error("Error fetching user details:", error)
      toast.error("Failed to load user details")
    } finally {
      if (isLoading) setUserDetailsLoading(false)
    }
  }

  // Update user details
  const handleUpdateUserDetails = async () => {
    if (!personalInfo.username.trim() || !personalInfo.fullName.trim() || !personalInfo.email.trim()) {
      toast.error("Username, Full Name, and Email are required")
      return
    }

    setUserDetailsUpdating(true)
    try {
      const response = await fetch("http://localhost:8080/api/security/user/updatedetails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: personalInfo.username,
          fullName: personalInfo.fullName,
          email: personalInfo.email,
          phoneNumber: personalInfo.phoneNumber,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || "Failed to update user details")
      }

      toast.success("User details updated successfully!")
      // Fetch updated details again
      await fetchUserDetails(false)
    } catch (error) {
      console.error("Error updating user details:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update user details")
    } finally {
      setUserDetailsUpdating(false)
    }
  }

  // Fetch user details when Profile tab is clicked
  useEffect(() => {
    if (activeTab === "profile") {
      fetchUserDetails()
    }
  }, [activeTab])

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn")
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/pos", { replace: true })
  }

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all password fields")
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters")
      return
    }

    setPasswordLoading(true)
    try {
      const response = await fetch("http://localhost:8080/api/security/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || "Failed to change password")
      }

      toast.success("Password changed successfully!")
      setShowPasswordDialog(false)
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-muted-foreground mt-1 text-base">Configure your restaurant system preferences</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowLogoutDialog(true)}
                className="modern-button bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg hover:shadow-red-500/25 border-0 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl mb-6">
              <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern">
                <SettingsIcon className="w-4 h-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern">
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="modern-card shadow-modern-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5 text-primary" />
                      Restaurant Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="restaurant-name">Restaurant Name</Label>
                      <Input id="restaurant-name" defaultValue="RestaurantOS" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="restaurant-address">Address</Label>
                      <Input id="restaurant-address" defaultValue="123 Main Street, Downtown" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="restaurant-phone">Phone Number</Label>
                      <Input id="restaurant-phone" defaultValue="+1 (555) 123-4567" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="restaurant-email">Email</Label>
                      <Input id="restaurant-email" defaultValue="info@restaurantos.com" className="mt-1" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="modern-card shadow-modern-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-primary" />
                      System Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-save</Label>
                        <p className="text-sm text-muted-foreground">Automatically save changes</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                <Card className="modern-card shadow-modern-lg border-0 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Printer className="w-5 h-5 text-primary" />
                      Receipt printers (80mm thermal)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-normal">
                      For <span className="font-medium text-foreground">network / thermal printers</span> without the
                      Chrome print dialog, use <span className="font-medium text-foreground">QZ Tray</span> (install on
                      this PC, add printers in Windows) or run the optional{" "}
                      <span className="font-medium text-foreground">print-agent</span> service and choose HTTP below.
                      Printer names must match Windows exactly (Control Panel → Printers).
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-w-md space-y-2">
                      <Label htmlFor="print-backend">Print method</Label>
                      <Select
                        value={printCfg.printBackend}
                        onValueChange={(v) => setPrintCfg((p) => ({ ...p, printBackend: v as PrintBackend }))}
                      >
                        <SelectTrigger id="print-backend" className="mt-1">
                          <SelectValue placeholder="Choose method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="browser">Browser print dialog (Chrome / Edge)</SelectItem>
                          <SelectItem value="qz">QZ Tray — silent to named printers</SelectItem>
                          <SelectItem value="http">Local print agent (HTTP)</SelectItem>
                        </SelectContent>
                      </Select>
                      {printCfg.printBackend === "qz" ? (
                        <p className="text-xs text-muted-foreground">
                          Download QZ Tray from qz.io, install, then approve this site when prompted. Use the exact
                          printer name from Windows for each slot below.
                        </p>
                      ) : null}
                      {printCfg.printBackend === "http" ? (
                        <p className="text-xs text-muted-foreground">
                          Run <code className="text-foreground">npm install</code> and{" "}
                          <code className="text-foreground">npm start</code> in the <code className="text-foreground">print-agent</code>{" "}
                          folder (Windows). Set the agent URL below (e.g. http://127.0.0.1:9101).
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="print-customer">Customer bill printer</Label>
                        <Input
                          id="print-customer"
                          value={printCfg.customerPrinterName}
                          onChange={(e) => setPrintCfg((p) => ({ ...p, customerPrinterName: e.target.value }))}
                          placeholder="e.g. EPSON TM-T20III Receipt"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="print-k1">Kitchen 1 printer</Label>
                        <Input
                          id="print-k1"
                          value={printCfg.kitchen1PrinterName}
                          onChange={(e) => setPrintCfg((p) => ({ ...p, kitchen1PrinterName: e.target.value }))}
                          placeholder="Kitchen 1 station"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="print-k2">Kitchen 2 printer</Label>
                        <Input
                          id="print-k2"
                          value={printCfg.kitchen2PrinterName}
                          onChange={(e) => setPrintCfg((p) => ({ ...p, kitchen2PrinterName: e.target.value }))}
                          placeholder="Kitchen 2 station"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="print-agent">Print agent URL (HTTP mode only)</Label>
                      <Input
                        id="print-agent"
                        value={printCfg.printAgentUrl}
                        onChange={(e) => setPrintCfg((p) => ({ ...p, printAgentUrl: e.target.value }))}
                        placeholder="http://127.0.0.1:9101"
                        className="mt-1 max-w-xl"
                        disabled={printCfg.printBackend !== "http"}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        savePrintPrinterConfig(printCfg)
                        toast.success("Printer settings saved")
                      }}
                    >
                      Save printer names
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Profile Settings */}
            <TabsContent value="profile" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="modern-card shadow-modern-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {userDetailsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading user details...</p>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="admin-username">Username</Label>
                          <Input 
                            id="admin-username" 
                            value={personalInfo.username} 
                            onChange={(e) => setPersonalInfo({ ...personalInfo, username: e.target.value })}
                            className="mt-1" 
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-name">Full Name</Label>
                          <Input 
                            id="admin-name" 
                            value={personalInfo.fullName}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                            className="mt-1" 
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-email">Email Address</Label>
                          <Input 
                            id="admin-email" 
                            value={personalInfo.email}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                            className="mt-1" 
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-phone">Phone Number</Label>
                          <Input 
                            id="admin-phone" 
                            value={personalInfo.phoneNumber}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, phoneNumber: e.target.value })}
                            className="mt-1" 
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-role">Role</Label>
                          <Input 
                            id="admin-role" 
                            value={personalInfo.role} 
                            className="mt-1" 
                            disabled 
                          />
                        </div>
                        <Button
                          onClick={() => void handleUpdateUserDetails()}
                          disabled={userDetailsUpdating}
                          className="w-full mt-4 modern-button gradient-primary"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {userDetailsUpdating ? "Updating..." : "Update Details"}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="modern-card shadow-modern-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-primary" />
                      Profile Picture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <img 
                        src="/Admin.png" 
                        alt="Admin" 
                        className="w-16 h-16 rounded-full object-cover"
                      />
                      <div>
                        <Button variant="outline" size="sm">
                          <Upload className="w-4 h-4 mr-2" />
                          Change Photo
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 2MB</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="modern-card shadow-modern-lg border-0 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-primary" />
                      Change Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Keep your account secure by changing your password regularly</p>
                    <Button
                      onClick={() => setShowPasswordDialog(true)}
                      className="modern-button gradient-primary"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="max-w-sm rounded-3xl border border-border/50 shadow-2xl bg-background p-0 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600" />

          <div className="p-7">
            <AlertDialogHeader className="text-center items-center gap-0 mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-rose-600/20 flex items-center justify-center mb-5 ring-4 ring-red-500/10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <LogOut className="w-5 h-5 text-white" />
                </div>
              </div>
              <AlertDialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                Leaving DineMate?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-muted-foreground text-sm leading-relaxed mt-2">
                Are you sure you want to logout?
                <br />
                You'll need your credentials to sign back in.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="flex-col gap-3 mt-6 sm:flex-col">
              <AlertDialogAction
                onClick={handleLogout}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold border-0 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Yes, Logout
              </AlertDialogAction>
              <AlertDialogCancel className="w-full h-11 rounded-xl bg-muted text-foreground font-semibold border border-border hover:bg-muted/70 hover:text-foreground transition-all duration-200 mt-0">
                No, Stay Here
              </AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent className="max-w-sm rounded-3xl border border-border/50 shadow-2xl bg-background p-0 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600" />

          <div className="p-7">
            <AlertDialogHeader className="text-center items-center gap-0 mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-5 ring-4 ring-green-500/10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Lock className="w-5 h-5 text-white" />
                </div>
              </div>
              <AlertDialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                Change Password
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-muted-foreground text-sm leading-relaxed mt-2">
                Enter your current password and a new password to update your account
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 mt-6">
              <div>
                <Label htmlFor="old-password" className="text-sm font-medium">Current Password</Label>
                <Input
                  id="old-password"
                  type="password"
                  placeholder="Enter your current password"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter your new password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="mt-2"
                />
              </div>
            </div>

            <AlertDialogFooter className="flex-col gap-3 mt-6 sm:flex-col">
              <AlertDialogAction
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold border-0 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-200 disabled:opacity-50"
              >
                <Lock className="w-4 h-4 mr-2" />
                {passwordLoading ? "Updating..." : "Update Password"}
              </AlertDialogAction>
              <AlertDialogCancel className="w-full h-11 rounded-xl bg-muted text-foreground font-semibold border border-border hover:bg-muted/70 hover:text-foreground transition-all duration-200 mt-0">
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

export default Settings
