import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, ArrowLeft } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { toast } from 'sonner';
import LoadingSpinner from '../components/LoadingSpinner';

interface CheckoutForm {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardName: string;
}

const Checkout = () => {
  const { items, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CheckoutForm>({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'España',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear cart and show success
      clearCart();
      toast.success('¡Pago procesado exitosamente!');
      navigate('/user-dashboard');
    } catch (error) {
      toast.error('Error al procesar el pago');
    } finally {
      setIsLoading(false);
    }
  };

  const subtotal = getTotalPrice();
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No hay productos en el carrito</h2>
          <button
            onClick={() => navigate('/store')}
            className="text-indigo-600 hover:text-indigo-500"
          >
            Ir a la tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/cart')}
        className="flex items-center text-indigo-600 hover:text-indigo-500 mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Volver al carrito
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Checkout Form */}
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalizar compra</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Información de contacto</h2>
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="email"
                    name="email"
                    placeholder="Correo electrónico"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Dirección de envío</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="firstName"
                    placeholder="Nombre"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Apellidos"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    name="address"
                    placeholder="Dirección"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    className="md:col-span-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    name="city"
                    placeholder="Ciudad"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    name="postalCode"
                    placeholder="Código postal"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Información de pago
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="text"
                    name="cardName"
                    placeholder="Nombre en la tarjeta"
                    value={formData.cardName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    name="cardNumber"
                    placeholder="Número de tarjeta"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="expiryDate"
                      placeholder="MM/AA"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      name="cvv"
                      placeholder="CVV"
                      value={formData.cvv}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-600">
                  <Lock className="h-4 w-4 mr-2" />
                  Tu información de pago está protegida con encriptación SSL
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 font-medium flex items-center justify-center"
              >
                {isLoading ? (
                  <LoadingSpinner />
                ) : (
                  `Pagar $${total.toFixed(2)}`
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:sticky lg:top-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Resumen del pedido</h2>
            
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">Cantidad: {item.quantity}</p>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 mt-6 pt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Envío</span>
                <span className="font-medium">Gratis</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Impuestos</span>
                <span className="font-medium">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;