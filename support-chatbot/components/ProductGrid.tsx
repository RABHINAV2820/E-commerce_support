"use client";
import styles from "./ProductGrid.module.css";

type Product = {
  id: string;
  name: string;
  price: number;
  image?: string;
};

const products: Product[] = [
  { id: "1", name: "Wireless Headphones", price: 99.99, image: "/images/p1.png" },
  { id: "2", name: "Smart Watch", price: 149.0, image: "/images/p2.png" },
  { id: "3", name: "Portable Speaker", price: 59.0, image: "/images/p3.png" },
  { id: "4", name: "Gaming Mouse", price: 39.0, image: "/images/p4.png" },
  { id: "5", name: "Running Shoes", price: 89.0, image: "/images/p5.png" },
  { id: "6", name: "Backpack", price: 49.0, image: "/images/p6.png" }
];

export default function ProductGrid() {
  return (
    <div className={styles.grid}>
      {products.map((p) => (
        <div key={p.id} className={styles.card}>
          <div className={styles.thumb} style={p.image ? { backgroundImage: `url(${p.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
          <div className={styles.info}>
            <div className={styles.name}>{p.name}</div>
            <div className={styles.meta}>
              <span className={styles.price}>${p.price.toFixed(2)}</span>
              <div className={styles.actions}>
                <button className={styles.add} aria-label={`Add ${p.name} to cart`}>Add to Cart</button>
                <button className={styles.ghost} aria-label={`View details for ${p.name}`}>Details</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

