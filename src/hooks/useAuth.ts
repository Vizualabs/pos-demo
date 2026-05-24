export type UserRole = "ADMIN" | "USER" | "GUEST";

const normalizeRole = (role: unknown): string => {
  return String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, "");
};

export const useAuth = () => {
  const getUserRole = (): UserRole => {
    if (typeof window === "undefined") return "GUEST";
    
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return "GUEST";
      
      const user = JSON.parse(userStr);
      
      let roleNames: string[] = [];
      
      // Check for authorities array (Spring Security format)
      if (user?.authorities && Array.isArray(user.authorities)) {
        roleNames = user.authorities.map((auth: any) => {
          if (typeof auth === 'string') {
            return normalizeRole(auth);
          }
          if (auth?.authority) {
            return normalizeRole(auth.authority);
          }
          if (auth?.name || auth?.role) {
            return normalizeRole(auth.name || auth.role);
          }
          return "";
        }).filter((role: string) => role);
      }
      
      // Check for role field directly (could be "ROLE_ADMIN" or "ADMIN")
      if (!roleNames.length && user?.role) {
        const role = normalizeRole(user.role);
        if (role) roleNames = [role];
      }
      
      // Check for roles array
      if (!roleNames.length && user?.roles && Array.isArray(user.roles)) {
        roleNames = user.roles.map((r: any) => 
          normalizeRole(typeof r === 'string' ? r : r.name || r.authority || r.role)
        ).filter((role: string) => role);
      }

      if (roleNames.includes("ADMIN")) return "ADMIN";
      if (roleNames.includes("USER")) return "USER";
      
      return "GUEST";
    } catch (error) {
      console.error("Error parsing user role:", error);
      return "GUEST";
    }
  };

  const isAdmin = (): boolean => {
    const role = getUserRole();
    return role === "ADMIN";
  };
  
  const isUser = (): boolean => ["USER", "ADMIN"].includes(getUserRole());
  const isLoggedIn = (): boolean => localStorage.getItem("isLoggedIn") === "true";

  return {
    getUserRole,
    isAdmin,
    isUser,
    isLoggedIn,
  };
};
