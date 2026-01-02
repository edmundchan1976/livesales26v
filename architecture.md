
# 🏗 Technical Architecture

## Google Sheets Apps Script (The Brain)
Copy and replace your entire script with this code. It allows the app to read both Inventory and Orders directly from your Sheet.

```javascript
/**
 * Helper to get current Singapore Time
 */
function getSGTNow() {
  return Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
}

/**
 * Handle GET requests: Fetch inventory AND orders for Seller Dashboard
 */
function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const inventorySheet = ss.getSheetByName("Inventory");
    const orderSheet = ss.getSheetByName("Orders");
    
    let inventory = [];
    let orders = [];

    // 1. Fetch Inventory
    if (inventorySheet) {
      const data = inventorySheet.getDataRange().getValues().slice(2);
      inventory = data.map(row => ({
        mnemonic: String(row[0]),
        category: String(row[1]),
        name: String(row[2]),
        initial: row[3],
        sold: row[4],
        quantity: row[5], // Balance
        waitlisted: row[6]
      }));
    }

    // 2. Fetch Orders
    if (orderSheet) {
      const data = orderSheet.getDataRange().getValues().slice(1);
      orders = data.map(row => ({
        OrderID: String(row[0]),
        Timestamp: String(row[1]),
        Buyer: String(row[2]),
        Email: String(row[3]),
        ItemName: String(row[4]),
        Mnemonic: String(row[5]),
        Quantity: row[6],
        Address: String(row[7]),
        AppStatus: String(row[8])
      }));
    }
    
    const result = {
      Inventory: inventory,
      Orders: orders
    };
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({Inventory: [], Orders: [], error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Webhook Entry Point: Handle POST requests from App
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!e || !e.postData || !e.postData.contents) throw new Error("No payload");
    
    const payload = JSON.parse(e.postData.contents);
    const nowSgt = getSGTNow();

    // 1. Update Master Stock Levels
    let masterSheet = ss.getSheetByName("Master_Inventory") || ss.insertSheet("Master_Inventory");
    masterSheet.clear();
    masterSheet.appendRow(["Category", "Item Name", "Price", "Initial Stock", "Mnemonic", "AllowUpsell"]);
    payload.Inventory.forEach(item => {
      masterSheet.appendRow([item.Category, item.ItemName, item.Price, item.InitialQuantity, item.Mnemonic, item.AllowUpsell]);
    });

    // 2. Log Orders
    let orderSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
    if (orderSheet.getLastRow() === 0) {
      orderSheet.appendRow(["OrderID", "Timestamp", "Buyer", "Email", "ItemName", "Mnemonic", "Quantity", "Address", "Status", "Payment"]);
    }
    
    const existingIds = orderSheet.getLastRow() > 1 
      ? orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 1).getValues().flat().map(String) 
      : [];

    payload.Orders.forEach(o => {
      if (!existingIds.includes(String(o.OrderID))) {
        orderSheet.appendRow([o.OrderID, o.Timestamp, o.Buyer, o.Email, o.ItemName, o.Mnemonic, o.Quantity, o.Address, "Processing", "Pending"]);
      }
    });

    runInventoryEngine(ss);
    return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

function runInventoryEngine(ss) {
  // Logic to calculate Confirmed vs Waitlisted based on FIFO
  const masterSheet = ss.getSheetByName("Master_Inventory");
  const orderSheet = ss.getSheetByName("Orders");
  const inventorySheet = ss.getSheetByName("Inventory") || ss.insertSheet("Inventory");

  if (masterSheet.getLastRow() < 2) return;

  const masterData = masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 6).getValues();
  const orderRange = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 10);
  const orderData = orderRange.getValues();

  let stockLevels = {};
  masterData.forEach(row => {
    stockLevels[row[4]] = { category: row[0], name: row[1], price: row[2], initial: row[3], remaining: row[3], sold: 0, waitlisted: 0 };
  });

  orderData.forEach(order => {
    const mnemonic = order[5];
    const qty = parseInt(order[6]);
    const stock = stockLevels[mnemonic];
    if (stock && stock.remaining >= qty) {
      stock.remaining -= qty;
      stock.sold += qty;
      order[8] = "Confirmed";
    } else {
      if (stock) stock.waitlisted += qty;
      order[8] = "Waitlisted";
    }
  });

  orderRange.setValues(orderData);

  inventorySheet.clear();
  inventorySheet.appendRow(["Mnemonic", "Category", "Item Name", "Initial Stock", "Confirmed Sold", "Available Balance", "Waitlist Demand"]);
  Object.keys(stockLevels).forEach(m => {
    const s = stockLevels[m];
    inventorySheet.appendRow([m, s.category, s.name, s.initial, s.sold, s.remaining, s.waitlisted]);
  });
}
```
