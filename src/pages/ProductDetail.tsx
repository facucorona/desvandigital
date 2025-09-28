import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ShoppingCart, ArrowLeft, Star, Heart } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock: number;
  rating: number;
  reviews_count: number;
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        // Mock product data for now
        const mockProduct: Product = {
          id: id || '1',
          name: 'Curso Avanzado de Diseño Digital',
          description: 'Aprende las técnicas más avanzadas de diseño digital con herramientas profesionales. Este curso incluye proyectos prácticos, feedback personalizado y acceso a recursos exclusivos.',
          price: 299.99,
          image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20digital%20design%20course%20cover%20with%20colorful%20graphics%20and%20professional%20tools&image_size=landscape_4_3',
          category: 'Cursos',
          stock: 50,
          rating: 4.8,
          reviews_count: 127
        };
        
        setTimeout(() => {
          setProduct(mockProduct);
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        toast.error('Error al cargar el producto');
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity
      });
      toast.success('Producto agregado al carrito');
    }
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast.success(isFavorite ? 'Eliminado de favoritos' : 'Agregado a favoritos');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Producto no encontrado</h2>
          <button
            onClick={() => navigate('/store')}
            className="text-indigo-600 hover:text-indigo-500"
          >
            Volver a la tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-indigo-600 hover:text-indigo-500 mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="aspect-w-1 aspect-h-1">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-96 object-cover rounded-lg shadow-lg"
          />
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-2">{product.category}</p>
          </div>

          {/* Rating */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < Math.floor(product.rating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">
              {product.rating} ({product.reviews_count} reseñas)
            </span>
          </div>

          {/* Price */}
          <div className="text-3xl font-bold text-indigo-600">
            ${product.price}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Descripción</h3>
            <p className="text-gray-600">{product.description}</p>
          </div>

          {/* Stock */}
          <div className="text-sm text-gray-600">
            {product.stock > 0 ? (
              <span className="text-green-600">✓ En stock ({product.stock} disponibles)</span>
            ) : (
              <span className="text-red-600">✗ Agotado</span>
            )}
          </div>

          {/* Quantity and Actions */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                Cantidad:
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[...Array(Math.min(10, product.stock))].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Agregar al carrito</span>
              </button>
              
              <button
                onClick={toggleFavorite}
                className={`px-4 py-3 rounded-md border-2 transition-colors ${
                  isFavorite
                    ? 'border-red-500 text-red-500 bg-red-50'
                    : 'border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-500'
                }`}
              >
                <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;