export default function EventLogo({ variant = "gold" }: { variant?: "gold" | "black" }) {
  return <svg role="img" aria-label="Serena Riverside" viewBox={variant === "black" ? "126 341 591 161" : "76 303 670 218"} width="220" height="75" style={{display:"block",maxWidth:"100%"}}>
    <image href={variant === "black" ? "/logo-black-original.png" : "/logo-gold-original.png"} width="843" height="843" />
  </svg>;
}
