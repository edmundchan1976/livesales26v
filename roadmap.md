
# 🗺 Product Roadmap

## Phase 1: MVP Refinement (Current)
- [x] AI Inventory Extraction.
- [x] QR Mnemonic Generation.
- [x] Google Sheets Live Sync.
- [x] Basic Analytics & Waitlist.

## Phase 2: Enhanced Reliability
- **Real-time WebSockets**: Move from Webhooks to a real-time backend (Supabase/Firebase) to prevent inventory overselling in high-traffic scenarios.
- **Image Hosting**: AI extraction currently works with local uploads; integration with S3/Cloudinary for document archiving.
- **Multi-user Support**: Role-based access for multiple sellers under one hub.

## Phase 3: Commercialization
- **Stripe Integration**: Move from "Payment Pending" to real-time credit card processing.
- **Automated Notifications**: Email/SMS alerts to buyers when they are moved from the Waitlist to Confirmed status.
- **Print API Integration**: One-click thermal printing for packing slips directly from the order log.

## Phase 4: AI Optimization
- **Predictive Restocking**: AI analysis of order patterns to suggest when to reorder specific categories.
- **Voice Commands**: Seller dashboard "Hands-free" mode for stock adjustment.
