# AgroLoop 🧅

AgroLoop is a modern, premium web application designed to connect farmers directly with commercial clients. It optimizes the onion supply chain by offering inventory tracking, real-time status notifications, Razorpay-based payments, and a powerful Admin Dashboard featuring automatic AI-driven batch grading (Fresh, Sprouted, Rotten) and waste reduction analytics.
            
---

## Technical Architecture

- **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB)
- **Frontend**: React (v19), TypeScript, Vite, Tailwind CSS, Zustand, Recharts, Socket.IO Client
- **Real-time Engine**: Socket.IO for server-to-client order updates & inventory refetches
- **Payments Gateway**: Razorpay Integration (for order checkout & signature verification)

---

## Directory Structure

```
agro/
├── server/       # Node.js backend (Express + TypeScript)
│   ├── src/
│   │   ├── config/      # DB and Environment config
│   │   ├── controllers/ # Express route controllers (auth, inventory, orders, admin, etc.)
│   │   ├── middleware/  # Auth guards, role permissions, errors
│   │   ├── models/      # Mongoose schemas (User, InventoryBatch, Order, Payment, Notification)
│   │   ├── routes/      # Express API routes
│   │   ├── services/    # Business logic & background state triggers
│   │   └── tests/       # End-to-End API Integration test suite
│   ├── package.json
│   └── tsconfig.json
│
└── client/       # React frontend (Vite + TS + Tailwind)
    ├── src/
    │   ├── api/         # Axios API clients
    │   ├── components/  # Shared dashboard & UI components
    │   ├── layouts/     # Protected route layouts & Sidebars
    │   ├── pages/       # Portal views (Admin, Client, Farmer)
    │   ├── stores/      # Zustand state stores (auth, order, admin, payments, notifications)
    │   └── utils/       # Helpers and formatters
    ├── package.json
    └── tailwind.config.js
```

---

## Local Setup Instructions

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v22+ recommended)
- **MongoDB**: A running local MongoDB instance or a MongoDB Atlas connection string.

### 2. Backend Setup
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `server` directory (based on `.env.example`):
   ```env
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/agroloop
   JWT_SECRET=your_jwt_signing_secret_key
   JWT_EXPIRES_IN=7d
   RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   CLIENT_URL=http://localhost:5173
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Navigate to the client folder:
   ```bash
   cd ../client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `client` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173`.

---

## Running Integration Tests

AgroLoop includes a comprehensive end-to-end API integration test runner that validates user authorization, automated batch classification, order logic, payment simulation, notifications, and admin statistics.

To run the test suite:
1. Ensure your backend `.env` is configured with a valid `MONGO_URI`.
2. Run the test command from the `server` directory:
   ```bash
   npm run test:e2e
   ```
3. The runner will start a test server, perform clean mock integrations, display execution indicators, and tear down gracefully.

---

## Supply Classification Rules (AI-driven)

Inventory batches automatically categorize themselves based on age and status:
1. **Grade A (Fresh)**: Newly harvested stock (harvest date within the last 30 days) of high quality.
2. **Sprouted (Salvaged)**: Supply whose harvest date exceeds 30 days. This represents stock salvaged for processing/other purposes.
3. **Rotten (Waste)**: Supply left unsold for a long duration (exceeding 60 days from intake) or explicitly marked as `expired`.
4. **Manual Overrides**: Farmers can manually override a batch to "Sprouted" or "Rotten" which takes precedence. Once a batch is sold, its status is locked and classification remains unchanged.

---

## Production Deployment Checklist

### 1. MongoDB Atlas Setup
- Create a shared cluster on MongoDB Atlas.
- In **Network Access**, add the IP address of your deployment server (or `0.0.0.0/0` if deploying to serverless backends like Render).
- Retrieve your connection URI and replace database username/password.

### 2. Backend Deployment (Render)
- **Repository Root**: Select the workspace subfolder `server`.
- **Environment**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: Make sure to set `NODE_ENV=production`, `PORT=10000`, `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `CLIENT_URL` (your client Vercel domain).

### 3. Frontend Deployment (Vercel)
- **Framework Preset**: Vite
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Add `VITE_API_URL` pointing to your Render backend API URL (e.g., `https://agroloop-api.onrender.com/api`).
- **React Router Fix**: Add a `vercel.json` file inside your client root folder to support SPA routes redirecting to `index.html`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
