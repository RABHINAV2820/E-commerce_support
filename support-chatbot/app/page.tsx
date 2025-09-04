import ProductGrid from "@/components/ProductGrid";
import SupportWidget from "@/components/SupportWidget";

export default function HomePage() {
  return (
    <main>
      <section className="container">
        <div className="catalogue-header">
          <h1>Our Catalogue</h1>
          <p>Discover our latest collection of premium products</p>
        </div>
        <ProductGrid />
      </section>
      <SupportWidget />
    </main>
  );
}

