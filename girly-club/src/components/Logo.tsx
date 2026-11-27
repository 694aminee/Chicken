/**
 * Logo texte (en attendant le fichier officiel).
 * Pour utiliser le vrai logo : déposer `public/logo.png` et remplacer ce composant par <Image src="/logo.png" … />.
 */
export function Logo({ size = 44, className = "", onDark = false }: { size?: number; className?: string; onDark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden
        className={`flex shrink-0 flex-col items-center justify-center rounded-full bg-charcoal text-cream ${onDark ? "ring-1 ring-cream/25" : ""}`}
        style={{ width: size, height: size }}
      >
        <span className="font-serif leading-none font-semibold" style={{ fontSize: size * 0.3 }}>
          Girly
        </span>
        <span className="font-script leading-none text-terracotta" style={{ fontSize: size * 0.26, marginTop: -size * 0.02 }}>
          Club
        </span>
      </span>
      <span className="font-serif text-lg leading-none font-semibold tracking-tight">
        The Girly <span className="font-script text-2xl font-normal text-terracotta">Club</span>
      </span>
    </span>
  );
}
