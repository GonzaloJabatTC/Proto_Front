import logoFull from "../assets/logos/logo-full.svg";
import logoMark from "../assets/logos/logo-mark.svg";

// Swap the SVGs in src/assets/logos/ (keep the file names) to rebrand.
export { logoFull, logoMark };

export function BrandLogo() {
  return <img className="brand-logo" src={logoFull} alt="Logo" />;
}
