import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <h1>Stripe + Resend Premium Gate</h1>
      <p>Production-ready SaaS subscription scaffold with deterministic billing state.</p>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/pricing">Pricing</Link>
        <Link href="/auth">Auth</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  );
}
