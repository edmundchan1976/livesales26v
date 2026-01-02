
# 🚀 Mnemonic Inventory Hub

A high-performance, AI-integrated MVP for high-velocity sellers. This application streamlines inventory input through AI document extraction and provides a unique QR-based mobile ordering experience for buyers.

## ✨ Core Features

- **🤖 AI Inventory Extraction**: Upload packing lists or shipping docs; Google Gemini Flash extracts structured data (Category, Name, Price, Qty) automatically.
- **🔢 Mnemonic Logic**: Generates human-readable shortcodes (e.g., `BEEF10`) for rapid identification and scanning.
- **📱 QR-First Ordering**: One-click QR generation for items. Buyers scan to access a mobile-optimized checkout form.
- **📊 Priority Analytics**: Drag-and-drop inventory to set sales priority, visualized against actual demand.
- **☁️ Google Sheets Sync**: Real-time synchronization of inventory and orders to a Google Sheet via Webhooks.
- **⏳ Waitlist Management**: Automated handling of out-of-stock items with configurable waitlist capacity.

## 🚀 Deployment (Vercel)

This project is a **build-less React app** using native ESM.

1. **Push to GitHub**: Create a new repository and push this code.
2. **Connect to Vercel**: Import the repository in the Vercel Dashboard.
3. **Set Environment Variables (IMPORTANT)**:
   - Go to your Project on Vercel.
   - Click **Settings** (top tab).
   - Click **Environment Variables** (left sidebar).
   - **Key**: `API_KEY`
   - **Value**: `[Your Gemini API Key from Google AI Studio]`
   - Click **Save**.
4. **Redeploy**: Go to the **Deployments** tab and redeploy the latest commit so the key takes effect.

## 🛠 Setup & Google Sheets Integration

To enable the Live DB sync:
1. Create a Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste the provided `doPost` script (see `architecture.md`).
4. Deploy as a **Web App** with access set to "Anyone".
5. Paste the generated URL into the **System Settings** in the Seller Dashboard.

---
*Built with React (ES6+), Tailwind CSS, and Google Gemini API.*
