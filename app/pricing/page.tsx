const TIERS = [
  { name: "free", price: "$0", features: ["Basic dashboard", "Community support"] },
  { name: "pro", price: "$29", features: ["Advanced analytics", "Priority support"] },
  { name: "fintech", price: "$99", features: ["Compliance reports", "Risk insights", "SLA support"] },
] as const;

export default function PricingPage() {
  return (
    <main>
      <h1>Pricing</h1>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {TIERS.map((tier) => (
          <section key={tier.name} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2>{tier.name.toUpperCase()}</h2>
            <p>{tier.price}/month</p>
            <ul>
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
