import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { toast } from 'sonner';

const Cart = () => {
  const { items, updateQuantity, removeFromCart, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromCart(id);
      toast.success('Producto eliminado del carrito');
    } else {
      updateQuantity(id, newQuantity);
    }
  };

  const handleRemoveItem = (id: string) => {
    removeFromCart(id);
    toast.success('Producto eliminado del carrito');
  };

  const handleClearCart = () => {
    clearCart();
    toast.success('Carrito vaciado');
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <ShoppingBag className="mx-auto h-24 w-24 text-gray-400" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Tu carrito está vacío</h2>
          <p className="mt-4 text-lg text-gray-600">
            Explora nuestra tienda y encuentra productos increíbles
          </p>
          <div className="mt-8">
            <Link
              to="/store"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Ir a la tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Carrito de compras</h1>
        <button
          onClick={handleClearCart}
          className="text-red-600 hover:text-red-500 text-sm font-medium"
        >
          Vaciar carrito
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {items.map((item) => (
                <li key={item.id} className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <img
                        className="h-20 w-20 rounded-lg object-cover"
                        src={item.image_url}
                        alt={item.name}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {item.name}
                      </h3>
                      <p className="text-lg font-semibold text-indigo-600">
                        ${item.price}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-2 text-red-600 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-sm rounded-lg p-6 sticky top-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Resumen del pedido</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${getTotalPrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Envío</span>
                <span className="font-medium">Gratis</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Impuestos</span>
                <span className="font-medium">${(getTotalPrice() * 0.1).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${(getTotalPrice() * 1.1).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleCheckout}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 font-medium"
              >
                {isLoading ? 'Procesando...' : 'Proceder al pago'}
              </button>
              
              <Link
                to="/store"
                className="w-full block text-center bg-gray-100 text-gray-900 py-3 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 font-medium"
              >
                Continuar comprando
              </Link>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Envío gratis en pedidos superiores a $100
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;