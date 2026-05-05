import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database(':memory:');

// Initialize database
db.serialize(() => {
  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    originalPrice REAL,
    category TEXT,
    image TEXT,
    stock INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Product variants table (sizes, colors)
  db.run(`CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    size TEXT,
    color TEXT,
    stock INTEGER DEFAULT 0,
    FOREIGN KEY (productId) REFERENCES products(id)
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderNumber TEXT UNIQUE NOT NULL,
    customerName TEXT NOT NULL,
    customerEmail TEXT,
    customerPhone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    paymentMethod TEXT,
    trackingNumber TEXT,
    deliveryStatus TEXT DEFAULT 'processing',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Order items table
  db.run(`CREATE TABLE IF NOT EXISTS orderItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    productName TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    size TEXT,
    color TEXT,
    FOREIGN KEY (orderId) REFERENCES orders(id),
    FOREIGN KEY (productId) REFERENCES products(id)
  )`);

  // Insert sample products
  const sampleProducts = [
    { name: 'Premium Yoga Leggings', description: 'High-quality yoga leggings with superior comfort', price: 89000, originalPrice: 120000, category: 'leggings', image: '🧘', stock: 15 },
    { name: 'High-Performance Sports Top', description: 'Moisture-wicking sports top for intense workouts', price: 59000, category: 'tops', image: '👕', stock: 22 },
    { name: 'Supportive Sports Bra', description: 'Premium sports bra with excellent support', price: 79000, category: 'sports bras', image: '🏃', stock: 18 },
    { name: 'Breathable Running Shorts', description: 'Lightweight shorts perfect for running', price: 49000, category: 'shorts', image: '🩳', stock: 25 },
    { name: 'Compression Leggings', description: 'Compression technology for enhanced performance', price: 99000, originalPrice: 140000, category: 'leggings', image: '🧘', stock: 12 },
    { name: 'Moisture-Wicking Tank Top', description: 'Breathable tank top for any activity', price: 54000, category: 'tops', image: '👕', stock: 30 },
    { name: 'Seamless Sports Bra', description: 'Seamless design for ultimate comfort', price: 74000, category: 'sports bras', image: '🏃', stock: 20 },
    { name: 'Gym Shorts', description: 'Comfortable shorts for gym sessions', price: 44000, category: 'shorts', image: '🩳', stock: 28 }
  ];

  sampleProducts.forEach(product => {
    db.run(`INSERT INTO products (name, description, price, originalPrice, category, image, stock) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product.name, product.description, product.price, product.originalPrice, product.category, product.image, product.stock]
    );
  });

  // Insert sample variants
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const colors = ['Black', 'Navy', 'Gray', 'White', 'Pink', 'Purple'];
  
  for (let productId = 1; productId <= 8; productId++) {
    sizes.forEach(size => {
      colors.forEach(color => {
        db.run(`INSERT INTO variants (productId, size, color, stock) VALUES (?, ?, ?, ?)`,
          [productId, size, color, Math.floor(Math.random() * 10) + 1]
        );
      });
    });
  }
});

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get product by ID with variants
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    db.all('SELECT * FROM variants WHERE productId = ?', [id], (err, variants) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...product, variants });
    });
  });
});

// Create order
app.post('/api/orders', (req, res) => {
  const { customerName, customerEmail, customerPhone, address, city, items, totalAmount, paymentMethod } = req.body;
  const orderNumber = 'ORD-' + Date.now();

  db.run(
    `INSERT INTO orders (orderNumber, customerName, customerEmail, customerPhone, address, city, totalAmount, paymentMethod, status, deliveryStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'processing')`,
    [orderNumber, customerName, customerEmail, customerPhone, address, city, totalAmount, paymentMethod],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const orderId = this.lastID;
      let itemsInserted = 0;

      items.forEach(item => {
        db.run(
          `INSERT INTO orderItems (orderId, productId, productName, quantity, price, size, color)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.productId, item.productName, item.quantity, item.price, item.size, item.color],
          (err) => {
            if (err) console.error(err);
            itemsInserted++;
            if (itemsInserted === items.length) {
              res.json({ orderId, orderNumber, status: 'confirmed' });
            }
          }
        );
      });
    }
  );
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    db.all('SELECT * FROM orderItems WHERE orderId = ?', [id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, items });
    });
  });
});

// Get order by order number
app.get('/api/orders/track/:orderNumber', (req, res) => {
  const { orderNumber } = req.params;
  db.get('SELECT * FROM orders WHERE orderNumber = ?', [orderNumber], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    db.all('SELECT * FROM orderItems WHERE orderId = ?', [order.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, items });
    });
  });
});

// Update order status
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, deliveryStatus, trackingNumber } = req.body;
  
  db.run(
    `UPDATE orders SET status = ?, deliveryStatus = ?, trackingNumber = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, deliveryStatus, trackingNumber, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Order updated' });
    }
  );
});

// Get all orders (for admin)
app.get('/api/admin/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY createdAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Activewear Pro API is running' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Activewear Pro API running on http://localhost:${PORT}`);
  console.log(`✓ Products endpoint: http://localhost:${PORT}/api/products`);
  console.log(`✓ Orders endpoint: http://localhost:${PORT}/api/orders`);
});
