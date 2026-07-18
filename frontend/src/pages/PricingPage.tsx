import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const PricingPage = () => {
  const navigate = useNavigate();
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);

  const theme = {
    bg: '#0D1115',
    accent: '#4ADE80',
    cardBg: '#13181D',
    cardBorder: '#1F2933',
    textMain: '#FFFFFF',
    textMuted: '#8B949E'
  };

  const plans = [
    {
      name: "Starter",
      price: "Free",
      description: "Perfect for exploring agentic workflows.",
      features: [
        "Up to 3 active agents",
        "100 tasks per month",
        "Standard execution speed",
        "Community support"
      ],
      buttonText: "Start for Free",
      isPopular: false
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For professionals automating complex daily tasks.",
      features: [
        "Up to 15 active agents",
        "5,000 tasks per month",
        "Parallel workflow execution",
        "Priority email support",
        "Advanced DAG observability"
      ],
      buttonText: "Upgrade to Pro",
      isPopular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large teams needing limitless orchestration.",
      features: [
        "Unlimited active agents",
        "Unlimited tasks per month",
        "Dedicated cloud infrastructure",
        "24/7 priority support",
        "Custom integration building",
        "SSO & advanced security"
      ],
      buttonText: "Contact Sales",
      isPopular: false
    }
  ];

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg, color: theme.textMain,
      fontFamily: "'Inter', system-ui, sans-serif", position: "relative", overflow: "hidden"
    }}>
      {/* Grid Background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        pointerEvents: "none", zIndex: 0
      }} />

      {/* Subtle radial glow */}
      <div style={{
        position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(74, 222, 128, 0.06) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none", zIndex: 0
      }} />

      {/* Navigation */}
      <nav style={{
        position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 48px", width: "100%", maxWidth: 1400, margin: "0 auto"
      }}>
        {/* Logo */}
        <div 
          onClick={() => navigate('/')}
          style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 18, cursor: "pointer" }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.accent }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2E3640' }} />
          </div>
          Groit AI
        </div>

        <button
          onClick={() => navigate('/login')}
          style={{
            padding: "8px 20px", borderRadius: 30, background: theme.accent, color: "#000",
            fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, transition: "transform 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          Sign In ↗
        </button>
      </nav>

      {/* Main Content */}
      <main style={{ 
        display: "flex", flexDirection: "column", alignItems: "center", 
        paddingTop: "60px", paddingBottom: "100px", position: "relative", zIndex: 10 
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: 60, padding: "0 20px" }}
        >
          <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16, letterSpacing: "-1px" }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 18, color: theme.textMuted, maxWidth: 600, margin: "0 auto" }}>
            Scale your agentic orchestration seamlessly. Choose the plan that best fits your workflow requirements and team size.
          </p>
        </motion.div>

        <div style={{ 
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, 
          maxWidth: 1200, padding: "0 24px", width: "100%" 
        }}>
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              style={{
                flex: "1 1 300px", maxWidth: 350,
                background: theme.cardBg,
                border: `1px solid ${plan.isPopular ? theme.accent : theme.cardBorder}`,
                borderRadius: 24, padding: 32,
                position: "relative",
                display: "flex", flexDirection: "column",
                boxShadow: plan.isPopular ? "0 8px 40px rgba(74, 222, 128, 0.08)" : "0 4px 20px rgba(0,0,0,0.2)"
              }}
            >
              {plan.isPopular && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: theme.accent, color: "#000", fontSize: 12, fontWeight: 700,
                  padding: "4px 12px", borderRadius: 20, letterSpacing: 0.5
                }}>
                  MOST POPULAR
                </div>
              )}

              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{plan.name}</h3>
              <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 24, minHeight: 42 }}>{plan.description}</p>
              
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 32 }}>
                <span style={{ fontSize: 42, fontWeight: 700 }}>{plan.price}</span>
                {plan.period && <span style={{ color: theme.textMuted, fontWeight: 500 }}>{plan.period}</span>}
              </div>

              <button
                onClick={() => {
                  if (plan.name === "Starter") {
                    navigate('/dashboard');
                  } else {
                    setSelectedPlan(plan.name);
                    setShowCheckout(true);
                  }
                }}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  background: plan.isPopular ? theme.accent : "transparent",
                  color: plan.isPopular ? "#000" : theme.textMain,
                  border: `1px solid ${plan.isPopular ? theme.accent : theme.cardBorder}`,
                  fontWeight: 600, fontSize: 15, cursor: "pointer",
                  marginBottom: 32, transition: "all 0.2s"
                }}
                onMouseEnter={e => {
                  if (!plan.isPopular) {
                    e.currentTarget.style.borderColor = theme.textMuted;
                  }
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  if (!plan.isPopular) {
                    e.currentTarget.style.borderColor = theme.cardBorder;
                  }
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {plan.buttonText}
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMain, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  What's included
                </div>
                {plan.features.map(feature => (
                  <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <Check size={16} color={theme.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.4 }}>{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Checkout Modal */}
      {showCheckout && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)"
        }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 24,
              padding: 40, width: "100%", maxWidth: 450, position: "relative"
            }}
          >
            <button 
              onClick={() => setShowCheckout(false)}
              style={{
                position: "absolute", top: 20, right: 20, background: "none", border: "none", 
                color: theme.textMuted, cursor: "pointer", fontSize: 24
              }}
            >
              ×
            </button>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: theme.textMain }}>Upgrade to {selectedPlan}</h2>
            <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 14 }}>Enter your details to proceed with the subscription.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Full Name</label>
                <input type="text" placeholder="John Doe" style={{
                  width: "100%", padding: "12px 16px", borderRadius: 8, background: "#0D1115",
                  border: `1px solid ${theme.cardBorder}`, color: theme.textMain, outline: "none"
                }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Email Address</label>
                <input type="email" placeholder="john@company.com" style={{
                  width: "100%", padding: "12px 16px", borderRadius: 8, background: "#0D1115",
                  border: `1px solid ${theme.cardBorder}`, color: theme.textMain, outline: "none"
                }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Card Details</label>
                <input type="text" placeholder="Card Number" style={{
                  width: "100%", padding: "12px 16px", borderRadius: 8, background: "#0D1115",
                  border: `1px solid ${theme.cardBorder}`, color: theme.textMain, outline: "none"
                }} />
              </div>

              <button
                onClick={() => {
                  alert("Subscription processed successfully!");
                  setShowCheckout(false);
                  navigate('/dashboard');
                }}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, marginTop: 16,
                  background: theme.accent, color: "#000", border: "none",
                  fontWeight: 600, fontSize: 15, cursor: "pointer", transition: "transform 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                Proceed to Checkout
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PricingPage;
