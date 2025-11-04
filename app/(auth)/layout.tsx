// app/(auth)/layout.tsx
import Image from "next/image";
import "../globals.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="auth-grid"
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#080679ff", // koyu mavi arka plan
      }}
    >
      {/* Sol taraf: Görsel alanı */}
      <section
        className="auth-hero"
        style={{
          flex: 1.5, // ekranın yaklaşık 2/3'ünü kaplasın
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          src="/Logo-2.png" //  public klasöründeki dosya yolu
          alt="Portal ASO"
          width={500} // fill yerine width/height daha stabil olur
          height={500}
          priority
          style={{ objectFit: "contain" }}
        />
      </section>

      {/* Sağ taraf: Giriş formu */}
      <section
        className="auth-pane"
        style={{
          flex: 1,
          backgroundColor: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}
