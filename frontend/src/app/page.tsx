import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "3rem 2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Operations Intelligence</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Event-driven platform scaffold — admin dashboard and worker app.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/login">
          Sign in
        </Link>
        <Link className="btn" href="/admin">
          Admin
        </Link>
        <Link className="btn" href="/worker">
          Worker
        </Link>
      </div>
    </main>
  );
}
