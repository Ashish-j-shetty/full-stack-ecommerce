import { Link } from "react-router-dom";

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

export function ProductCard({
  id,
  name,
  price,
  image_url,
  stock,
  category,
}: ProductCardProps) {
  return (
    <div className="product-card">
      <Link to={`/products/${id}`} className="product-card-link">
        <img src={image_url} alt={name} className="product-card-image" />
        <div className="product-card-body">
          <span className="product-card-category">{category}</span>
          <h3 className="product-card-name">{name}</h3>
          <p className="product-card-price">${Number(price).toFixed(2)}</p>
          {stock === 0 && (
            <span className="product-card-out-of-stock">Out of Stock</span>
          )}
        </div>
      </Link>
    </div>
  );
}
