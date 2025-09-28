import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin,
  Heart
} from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    platform: [
      { label: 'Home', path: '/' },
      { label: 'Store', path: '/store' },
      { label: 'Study Routes', path: '/study-routes' },
      { label: 'Social Network', path: '/social' }
    ],
    features: [
      { label: '3D Attic', path: '/attic' },
      { label: 'Design Tools', path: '/design' },
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Messaging', path: '/messages' }
    ],
    support: [
      { label: 'Help Center', path: '/help' },
      { label: 'Contact Us', path: '/contact' },
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms of Service', path: '/terms' }
    ]
  };

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' }
  ];

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Box className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Desván Digital
              </span>
            </div>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Transform your digital experience with our comprehensive platform featuring 3D environments, 
              social networking, e-commerce, and educational tools.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>contact@desvandigital.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>Digital Innovation Hub</span>
              </div>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Platform</h3>
            <ul className="space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-purple-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Features Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Features</h3>
            <ul className="space-y-2">
              {footerLinks.features.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-purple-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Support</h3>
            <ul className="space-y-2 mb-6">
              {footerLinks.support.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-purple-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Social Links */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-white">Follow Us</h4>
              <div className="flex space-x-3">
                {socialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    className="w-8 h-8 bg-gray-800 hover:bg-purple-600 rounded-full flex items-center justify-center transition-colors"
                    aria-label={label}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="max-w-md mx-auto text-center lg:max-w-none lg:text-left lg:flex lg:items-center lg:justify-between">
            <div className="lg:flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Stay Updated</h3>
              <p className="text-gray-400 text-sm">
                Get the latest updates on new features, products, and platform improvements.
              </p>
            </div>
            <div className="mt-6 lg:mt-0 lg:ml-8">
              <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors font-medium">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm">
            © {currentYear} Desván Digital. All rights reserved.
          </div>
          <div className="flex items-center space-x-1 text-gray-400 text-sm mt-4 sm:mt-0">
            <span>Made with</span>
            <Heart className="w-4 h-4 text-red-500 fill-current" />
            <span>for digital innovation</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;