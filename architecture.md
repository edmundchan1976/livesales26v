
# 🏗 Technical Architecture

## Google Sheets Apps Script (The Brain)
Copy and paste this entire code block into your Google Sheets Apps Script editor (**Extensions > Apps Script**). 

This version includes a `doGet` function that allows the **Buyer Portal** on mobile to fetch your latest inventory automatically.

```javascript
/**
 * Helper to get current Singapore Time
 */
function getSGTNow() {
  return Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
}

/**
 * Handle GET requests: Fetch inventory for Buyer Portal
 */
function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const inventorySheet = ss.getSheetByName("Inventory");
    const masterSheet = ss.getSheetByName("Master_Inventory");
    
    if (!inventorySheet || !masterSheet) {
      return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    }
    
    const liveData = inventorySheet.getDataRange().getValues().slice(2);
    const masterData = masterSheet.getDataRange().getValues().slice(2);
    
    const masterMap = {};
    masterData.forEach(r => {
      masterMap[r[4]] = { price: r[2], allowUpsell: r[5] };
    });
    
    const output = liveData.map(row => {
      const mnemonic = row[0];
      const details = masterMap[mnemonic] || { price: 0, allowUpsell: false };
      return {
        mnemonic: mnemonic,
        category: row[1],
        name: row[2],
        quantity: row[5], // Available Balance
        price: details.price,
        allowUpsell: details.allowUpsell === true || details.allowUpsell === "TRUE"
      };
    });
    
    return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Webhook Entry Point: Handle POST requests
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Safety check for empty or invalid post data
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No payload received");
    }
    
    const payload = JSON.parse(e.postData.contents);
    const nowSgt = getSGTNow();

    // 1. Update Master Stock Levels
    let masterSheet = ss.getSheetByName("Master_Inventory") || ss.insertSheet("Master_Inventory");
    masterSheet.clear();
    masterSheet.getRange(1, 1).setValue("Initial Stock Snapshot (Last Synced SGT: " + nowSgt + ")").setFontWeight("bold");
    masterSheet.appendRow(["Category", "Item Name", "Price", "Initial Stock", "Mnemonic", "AllowUpsell"]);
    payload.Inventory.forEach(item => {
      masterSheet.appendRow([item.Category, item.ItemName, item.Price, item.InitialQuantity, item.Mnemonic, item.AllowUpsell]);
    });
    masterSheet.setFrozenRows(2);
    masterSheet.autoResizeColumns(1, 6);

    // 2. Log Orders
    let orderSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
    if (orderSheet.getLastRow() === 0) {
      orderSheet.appendRow(["OrderID", "Timestamp (SGT)", "Buyer", "Email", "ItemName", "Mnemonic", "Quantity", "Address", "Calculated Status", "Payment Status"]);
      orderSheet.getRange(1, 1, 1, 10).setBackground("#f1f5f9").setFontWeight("bold");
    }
    
    const existingIds = orderSheet.getLastRow() > 1 
      ? orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 1).getValues().flat().map(String) 
      : [];

    payload.Orders.forEach(o => {
      if (!existingIds.includes(String(o.OrderID))) {
        orderSheet.appendRow([
          o.OrderID, 
          o.Timestamp, 
          o.Buyer, 
          o.Email, 
          o.ItemName, 
          o.Mnemonic, 
          o.Quantity, 
          o.Address, 
          "Evaluating...", 
          "Pending"
        ]);
      }
    });

    // 3. RUN THE ENGINE
    runInventoryEngine(ss);

    return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

function runInventoryEngine(ss) {
  const masterSheet = ss.getSheetByName("Master_Inventory");
  const orderSheet = ss.getSheetByName("Orders");
  const inventorySheet = ss.getSheetByName("Inventory") || ss.insertSheet("Inventory");

  if (masterSheet.getLastRow() < 3) return;

  const masterData = masterSheet.getRange(3, 1, masterSheet.getLastRow() - 2, 5).getValues();
  const orderRange = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 10);
  const orderData = orderRange.getValues();

  let stockLevels = {};
  masterData.forEach(row => {
    stockLevels[row[4]] = {
      category: row[0],
      name: row[1],
      price: row[2],
      initial: row[3],
      remaining: row[3],
      sold: 0,
      waitlisted: 0
    };
  });

  const sortedOrders = [...orderData].sort((a, b) => new Date(a[1]) - new Date(b[1]));

  let orderStatusMap = {};
  sortedOrders.forEach(order => {
    const oid = order[0];
    const mnemonic = order[5];
    const qty = parseInt(order[6]);
    const stock = stockLevels[mnemonic];

    if (stock && stock.remaining >= qty) {
      stock.remaining -= qty;
      stock.sold += qty;
      orderStatusMap[oid] = "Confirmed";
    } else {
      if (stock) stock.waitlisted += qty;
      orderStatusMap[oid] = "WAITLISTED";
    }
  });

  const statusColumnValues = orderData.map(row => [orderStatusMap[row[0]] || "Unknown"]);
  orderSheet.getRange(2, 9, statusColumnValues.length, 1).setValues(statusColumnValues);

  inventorySheet.clear();
  inventorySheet.getRange(1, 1).setValue("📊 LIVE INVENTORY & WAITLIST TRACKER (SGT)").setFontWeight("bold").setFontSize(14);
  inventorySheet.getRange(1, 6).setValue("Last Calculation SGT: " + getSGTNow()).setFontColor("#64748b");
  
  inventorySheet.appendRow(["Mnemonic", "Category", "Item Name", "Initial Stock", "Confirmed Sold", "Available Balance", "Waitlist Demand (Units)"]);
  inventorySheet.getRange(2, 1, 1, 7).setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold");

  Object.keys(stockLevels).sort().forEach(mnemonic => {
    const s = stockLevels[mnemonic];
    inventorySheet.appendRow([mnemonic, s.category, s.name, s.initial, s.sold, s.remaining, s.waitlisted]);
  });

  inventorySheet.setFrozenRows(2);
  inventorySheet.autoResizeColumns(1, 7);
}
```
