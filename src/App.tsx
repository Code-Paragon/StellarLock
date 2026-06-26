import { lazy, Suspense, useEffect } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { Layout } from "@/components/layout/Layout"
import { PageSkeleton } from "@/components/ui/PageSkeleton"
import { trackPageView } from "@/lib/analytics"
export { prefetch } from "@/lib/prefetch"

const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })))
const CreateLock = lazy(() => import("./pages/CreateLock").then((m) => ({ default: m.CreateLock })))
const MyLocks = lazy(() => import("./pages/MyLocks").then((m) => ({ default: m.MyLocks })))
const LockDetail = lazy(() => import("./pages/LockDetail").then((m) => ({ default: m.LockDetail })))
const Explorer = lazy(() => import("./pages/Explorer").then((m) => ({ default: m.Explorer })))
const Discover = lazy(() => import("./pages/Discover").then((m) => ({ default: m.Discover })))
const History = lazy(() => import("./pages/History").then((m) => ({ default: m.History })))

export function App() {
  const location = useLocation()

  useEffect(() => {
    trackPageView()
  }, [location.pathname])

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: "#363636", color: "#fff" },
        }}
      />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/app/create" element={<CreateLock />} />
            <Route path="/app/locks" element={<MyLocks />} />
            <Route path="/app/lock/:id" element={<LockDetail />} />
            <Route path="/app/history" element={<History />} />
            <Route path="/explore" element={<Discover />} />
            <Route path="/explore/:token" element={<Explorer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

