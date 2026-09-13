import Image from "next/image";
export function BrandOrbit() {
  return (
    <div
      className="brand-orbit"
      aria-label="HAS Analytics: estatística, pesquisa e tecnologia"
    >
      <div className="orbit-ring orbit-one" aria-hidden="true">
        <i />
      </div>
      <div className="orbit-ring orbit-two" aria-hidden="true">
        <i />
      </div>
      <div className="orbit-ring orbit-three" aria-hidden="true">
        <i />
      </div>
      <div className="brand-coin">
        <Image
          src="/logo-has.analytics.png"
          width={340}
          height={340}
          alt="HAS Analytics"
          priority
        />
      </div>
      <span className="orbit-tag tag-research">01 / PESQUISA</span>
      <span className="orbit-tag tag-data">02 / DADOS</span>
      <span className="orbit-tag tag-tech">03 / TECNOLOGIA</span>
      <div className="orbit-caption">
        <span className="live-dot" />
        Método, clareza e aplicação.
      </div>
    </div>
  );
}
