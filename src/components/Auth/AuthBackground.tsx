import type { CSSProperties } from "react"

type ParticleSpec = {
  left: string
  size: number
  duration: string
  delay: string
  accent?: boolean
}

const PARTICLES: ParticleSpec[] = [
  { left: "8%",  size: 6, duration: "14s", delay: "0s"  },
  { left: "22%", size: 5, duration: "18s", delay: "3s",  accent: true },
  { left: "38%", size: 4, duration: "20s", delay: "6s"  },
  { left: "52%", size: 7, duration: "13s", delay: "1.5s", accent: true },
  { left: "66%", size: 5, duration: "17s", delay: "8s"  },
  { left: "80%", size: 6, duration: "15s", delay: "4s",  accent: true },
  { left: "92%", size: 4, duration: "22s", delay: "10s" },
]

export const AuthBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Faint grid for subtle depth */}
      <div className="auth-grid absolute inset-0" />

      {/* Slow rotating brand-color auroras (layered for depth) */}
      <div className="auth-aurora absolute inset-[-30%] rounded-full" />
      <div className="auth-aurora-green absolute inset-[-35%] rounded-full" />

      {/* Soft breathing green halo behind the card */}
      <div className="auth-halo left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Wispy green smoke ribbons */}
      <div
        className="auth-wisp auth-wisp--a"
        style={{ top: "8%", left: "-10%", width: "55%", height: "38%" }}
      />
      <div
        className="auth-wisp auth-wisp--b"
        style={{ bottom: "5%", right: "-12%", width: "60%", height: "42%" }}
      />
      <div
        className="auth-wisp auth-wisp--c"
        style={{ top: "35%", left: "20%", width: "50%", height: "32%" }}
      />

      {/* Diagonal light sweep */}
      <div className="auth-sheen" />

      {/* Floating brand-color blobs (denser green presence) */}
      <div className="auth-blob-a absolute top-0 right-0 w-[28rem] h-[28rem] bg-primary/30 rounded-full blur-3xl" />
      <div className="auth-blob-b absolute bottom-0 left-0 w-[28rem] h-[28rem] bg-primary/25 rounded-full blur-3xl" />
      <div className="auth-blob-c absolute top-1/3 left-1/3 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />

      {/* Rising brand-colored particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`auth-particle${p.accent ? " auth-particle--accent" : ""}`}
          style={{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: p.duration,
            animationDelay: p.delay,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

export default AuthBackground
