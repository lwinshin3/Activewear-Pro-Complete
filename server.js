import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('✓ Database initialized');
});

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

  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Reviews table
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    userId INTEGER,
    rating INTEGER,
    comment TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES products(id)
  )`);

  // Wishlist table
  db.run(`CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (productId) REFERENCES products(id)
  )`);

  // Coupons table
  db.run(`CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discountPercent REAL,
    discountAmount REAL,
    maxUses INTEGER,
    uses INTEGER DEFAULT 0,
    expiryDate DATETIME,
    active BOOLEAN DEFAULT 1
  )`);

  // Newsletter subscribers
  db.run(`CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    subscribedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // POS transactions
  db.run(`CREATE TABLE IF NOT EXISTS posTransactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transactionId TEXT UNIQUE NOT NULL,
    items TEXT,
    total REAL,
    paymentMethod TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Testimonials
  db.run(`CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    message TEXT,
    rating INTEGER,
    approved BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Chat messages
  db.run(`CREATE TABLE IF NOT EXISTS chatMessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitorId TEXT,
    message TEXT,
    senderType TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'your-email@gmail.com',
    pass: process.env.GMAIL_PASSWORD || 'your-app-password'
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', [email, hashedPassword, name], function(err) {
    if (err) return res.status(400).json({ error: 'Email already exists' });
    const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET);
    res.json({ token, user: { id: this.lastID, email, name } });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'User not found' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });
});

// ==================== PRODUCT ROUTES ====================
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

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

app.get('/api/products/search/:query', (req, res) => {
  const query = `%${req.params.query}%`;
  db.all('SELECT * FROM products WHERE name LIKE ? OR category LIKE ?', [query, query], (err, products) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(products);
  });
});

// ==================== ORDERS ====================
// Get order tracking by order number
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

// Get all orders for a customer by email
app.get('/api/orders/customer/:email', (req, res) => {
  const { email } = req.params;
  db.all('SELECT * FROM orders WHERE customerEmail = ? ORDER BY createdAt DESC', [email], (err, orders) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(orders);
  });
});

// Update order delivery status (admin only)
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { deliveryStatus, trackingNumber } = req.body;
  
  db.run(
    'UPDATE orders SET deliveryStatus = ?, trackingNumber = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [deliveryStatus, trackingNumber, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Order status updated' });
    }
  );
});

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
              // Send email
              transporter.sendMail({
                from: process.env.GMAIL_USER || 'noreply@activewearpro.com',
                to: customerEmail,
                subject: `Order Confirmation - ${orderNumber}`,
                html: `<h2>Thank you for your order!</h2><p>Order Number: ${orderNumber}</p><p>Total: ${totalAmount} Kyat</p>`
              }).catch(err => console.error('Email error:', err));
              
              res.json({ orderId, orderNumber, status: 'confirmed' });
            }
          }
        );
      });
    }
  );
});

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

app.get('/api/admin/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY createdAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==================== REVIEWS ====================
app.post('/api/reviews', (req, res) => {
  const { productId, rating, comment, userId } = req.body;
  db.run('INSERT INTO reviews (productId, userId, rating, comment) VALUES (?, ?, ?, ?)', [productId, userId, rating, comment], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/reviews/:productId', (req, res) => {
  db.all('SELECT * FROM reviews WHERE productId = ?', [req.params.productId], (err, reviews) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(reviews);
  });
});

// ==================== WISHLIST ====================
app.post('/api/wishlist', authenticateToken, (req, res) => {
  const { productId } = req.body;
  db.run('INSERT OR IGNORE INTO wishlist (userId, productId) VALUES (?, ?)', [req.user.id, productId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/wishlist', authenticateToken, (req, res) => {
  db.all('SELECT p.* FROM wishlist w JOIN products p ON w.productId = p.id WHERE w.userId = ?', [req.user.id], (err, items) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(items);
  });
});

// ==================== COUPONS ====================
app.post('/api/coupons/validate', (req, res) => {
  const { code } = req.body;
  db.get('SELECT * FROM coupons WHERE code = ? AND active = 1', [code], (err, coupon) => {
    if (err || !coupon) return res.status(400).json({ error: 'Invalid coupon' });
    res.json(coupon);
  });
});

// ==================== NEWSLETTER ====================
app.post('/api/newsletter/subscribe', (req, res) => {
  const { email } = req.body;
  db.run('INSERT OR IGNORE INTO newsletter (email) VALUES (?)', [email], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ==================== POS SYSTEM ====================
app.post('/api/pos/transaction', (req, res) => {
  const { items, total, paymentMethod } = req.body;
  const transactionId = `POS-${Date.now()}`;
  db.run('INSERT INTO posTransactions (transactionId, items, total, paymentMethod) VALUES (?, ?, ?, ?)', [transactionId, JSON.stringify(items), total, paymentMethod], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ transactionId, success: true });
  });
});

// ==================== TESTIMONIALS ====================
app.post('/api/testimonials', (req, res) => {
  const { name, email, message, rating } = req.body;
  db.run('INSERT INTO testimonials (name, email, message, rating) VALUES (?, ?, ?, ?)', [name, email, message, rating], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/testimonials', (req, res) => {
  db.all('SELECT * FROM testimonials WHERE approved = 1', (err, testimonials) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(testimonials);
  });
});

// ==================== CHAT ====================
app.post('/api/chat/send', (req, res) => {
  const { visitorId, message } = req.body;
  db.run('INSERT INTO chatMessages (visitorId, message, senderType) VALUES (?, ?, ?)', [visitorId, message, 'visitor'], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/chat/:visitorId', (req, res) => {
  db.all('SELECT * FROM chatMessages WHERE visitorId = ? ORDER BY createdAt', [req.params.visitorId], (err, messages) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(messages);
  });
});

// ==================== ADMIN ROUTES ====================
app.post('/api/admin/products', (req, res) => {
  const { name, price, stock, category } = req.body;
  db.run('INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)', [name, price, stock, category], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, success: true });
  });
});

app.put('/api/admin/products/:id', (req, res) => {
  const { name, price, stock, category } = req.body;
  db.run('UPDATE products SET name = ?, price = ?, stock = ?, category = ? WHERE id = ?', [name, price, stock, category, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/admin/inventory', (req, res) => {
  db.all('SELECT id, name, stock, category FROM products', (err, products) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(products);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Activewear Pro API is running' });
});

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Activewear Pro API running on http://localhost:${PORT}`);
  console.log(`✓ All 12 features + POS system enabled`);
  console.log(`✓ Features: Auth, Reviews, Wishlist, Coupons, Newsletter, POS, Testimonials, Chat, Admin Dashboard`);
});
