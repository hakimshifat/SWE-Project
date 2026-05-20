interface FeatureCard {
  title: string;
  text: string;
  meta: string;
}

export function FeatureCards({ title, subtitle, cards }: { title?: string; subtitle?: string; cards: FeatureCard[] }) {
  return (
    <section className="feature-card-section">
      {(title || subtitle) && (
        <div className="section-head">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      <div className="feature-card-grid">
        {cards.map((card, index) => (
          <article className="feature-card" style={{ "--delay": `${index * 80}ms` } as React.CSSProperties} key={card.title}>
            <span className="feature-card-meta">{card.meta}</span>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

