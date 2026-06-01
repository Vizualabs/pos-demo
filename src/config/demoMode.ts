/** Local POS testing — dummy menu + orders when VITE_USE_DEMO_DATA=true */
export function isDemoDataEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_USE_DEMO_DATA === "true"
}
