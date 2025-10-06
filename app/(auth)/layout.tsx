// app/(auth)/layout.tsx  — server component (tercih edilir)
import Image from "next/image";
import "../globals.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-grid" style={{background:'black'}}>
      {/* Sol 2/3: SVG illüstrasyon */}
      <section className="auth-hero">
        <div className="auth-hero-inner">
          {/* basePath otomatik uygulanır */}
          <Image
            src="7.svg"
            alt="Portal ASO"
            fill
            priority
            style={{ objectFit: "contain" }}
          />
        </div>
      </section>

      {/* Sağ 1/3: Form alanı */}
      <section className="auth-pane">
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}
