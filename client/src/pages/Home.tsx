import { useState, useMemo } from "react";
import { useFetch } from "../hooks/useFetch";
import { useDebounce } from "../hooks/useDebounce";
import { ProductCard } from "../components/ProductCard";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import "../styles/products.css";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

interface CategoriesResponse {
  categories: string[];
}

export function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (category) params.set("category", category);
    if (debouncedSearch) params.set("search", debouncedSearch);
    return params.toString();
  }, [page, category, debouncedSearch]);

  const { data, isLoading, error } = useFetch<ProductsResponse>(
    `/api/products?${queryParams}`,
  );
  const { data: catData } = useFetch<CategoriesResponse>(
    "/api/products/categories",
  );

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="home-page">
      <h1>Products</h1>

      <div className="products-toolbar">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
        />

        <div className="category-filters">
          <button
            className={`filter-btn ${category === "" ? "active" : ""}`}
            onClick={() => handleCategoryChange("")}
          >
            All
          </button>
          {catData?.categories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${category === cat ? "active" : ""}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <p className="error-text">{error}</p>}

      {!isLoading && data && data.data.length === 0 && (
        <EmptyState
          title="No products found"
          message="Try adjusting your search or filter."
        />
      )}

      {!isLoading && data && data.data.length > 0 && (
        <>
          <div className="product-grid">
            {data.data.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn btn-outline"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-outline"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
