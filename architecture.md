# 🏗 Technical Architecture

## Google Sheets Apps Script (Hub Engine v2.5)
Replace your entire Apps Script with this version. It ensures that every sync updates the "Last Sync" timestamp in cell J1 and that Analytics data matches correctly.

### Deployment Instructions
1. **Deployment**: Click `Deploy` > `New Deployment`.
2. **Type**: Select `Web App`.
3. **Execute As**: `Me`.
4. **Who has access**: `Anyone`.
5. **Final Step**: After deploying, copy the new URL and paste it into the **Settings** tab of the Mnemonic Hub app.

```javascript
/**
 * Hub Engine v2.5 - Mnemonic Inventory & Order Hub
 */

function getSGTNow() {
  return Utilities.formatDate(new Date(), "GMT+8", "dd MMM yyyy, HH:mm:ss");
}

/**
 * GET: Fetches data for the dashboard.
 */
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName("Inventory");
  const masterSheet = ss.getSheetByName("Master_Inventory");
  const orderSheet = ss.getSheetByName("Orders");
  
  let inventory = [];
  let orders = [];
  let lastSyncTS = "Never";

  try {
    let targetSheet = inventorySheet;
    if (!inventorySheet || inventorySheet.getLastRow() < 2) {
      targetSheet = masterSheet;
    }

    if (targetSheet && targetSheet.getLastRow() >= 2) {
      const data = targetSheet.getDataRange().getValues();
      const headers = data[0];
      
      const findCol = (name) => {
        const i = headers.findIndex(h => h.toLowerCase().replace(/\s/g, '').includes(name.toLowerCase()));
        return i > -1 ? i : null;
      };
      
      const idxMnemonic = findCol("Mnemonic");
      const idxCategory = findCol("Category");
      const idxName = findCol("ItemName") || findCol("Name");
      const idxPrice = findCol("Price");
      const idxInitial = findCol("InitialQuantity") || findCol("Quantity");
      const idxBalance = findCol("AvailableBalance") || findCol("Balance");
      const idxUpsell = findCol("AllowUpsell") || findCol("Upsell");

      inventory = data.slice(1).map(row => {
        const mnemonic = String(row[idxMnemonic] || "").trim();
        if (!mnemonic) return null;
        return {
          Mnemonic: mnemonic,
          Category: String(row[idxCategory] || "General"),
          ItemName: String(row[idxName] || "Unknown"),
          Price: parseFloat(row[idxPrice]) || 0,
          InitialQuantity: parseInt(row[idxInitial]) || 0,
          AvailableBalance: row[idxBalance] !== undefined ? parseInt(row[idxBalance]) : (parseInt(row[idxInitial]) || 0),
          AllowUpsell: row[idxUpsell] === true || String(row[idxUpsell]).toUpperCase() === "TRUE"
        };
      }).filter(it => it !== null);
      
      const rawTS = targetSheet.getRange("J1").getValue();
      lastSyncTS = rawTS ? String(rawTS).replace("LAST UPDATED: ", "") : "Active";
    }

    if (orderSheet && orderSheet.getLastRow() >= 2) {
      const data = orderSheet.getDataRange().getValues();
      orders = data.slice(1).map(row => ({
        OrderID: String(row[0]),
        Timestamp: String(row[1]),
        Buyer: String(row[2]),
        ItemName: String(row[4]),
        Mnemonic: String(row[5]),
        Quantity: row[6],
        Status: String(row[8])
      })).filter(o => o.Mnemonic);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      Inventory: inventory, 
      Orders: orders, 
      lastSync: lastSyncTS 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST: Updates Master Data and Orders
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const now = getSGTNow();

    if (payload.action === 'sync') {
      let masterSheet = ss.getSheetByName("Master_Inventory") || ss.insertSheet("Master_Inventory");
      masterSheet.clear().appendRow(["Category", "ItemName", "Price", "InitialQuantity", "Mnemonic", "AllowUpsell"]);
      payload.Inventory.forEach(item => {
        masterSheet.appendRow([item.Category, item.ItemName, item.Price, item.InitialQuantity, item.Mnemonic, item.AllowUpsell]);
      });
      masterSheet.getRange("J1").setValue("LAST UPDATED: " + now);

      let orderSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
      if (orderSheet.getLastRow() === 0) {
        orderSheet.appendRow(["OrderID", "Timestamp", "Buyer", "Email", "ItemName", "Mnemonic", "Quantity", "Address", "Status"]);
      }
      
      const existingIds = orderSheet.getLastRow() > 1 ? orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 1).getValues().flat().map(String) : [];
      payload.Orders.forEach(o => {
        if (!existingIds.includes(String(o.OrderID))) {
          orderSheet.appendRow([o.OrderID, o.Timestamp, o.Buyer, o.Email, o.ItemName, o.Mnemonic, o.Quantity, o.Address, o.AppStatus || "Processing"]);
        }
      });
      orderSheet.getRange("J1").setValue("LAST UPDATED: " + now);

      runInventoryEngine(ss);
      return ContentService.createTextOutput("SUCCESS");
    }
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message);
  }
}

/**
 * Engine: Forces population of 'Inventory' sheet from 'Master_Inventory' + 'Orders'
 */
function runInventoryEngine(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("Master_Inventory");
  const orderSheet = ss.getSheetByName("Orders");
  const inventorySheet = ss.getSheetByName("Inventory") || ss.insertSheet("Inventory");
  const now = getSGTNow();

  if (!masterSheet || masterSheet.getLastRow() < 2) return;
  const masterData = masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 6).getValues();
  
  let stockLevels = {};
  masterData.forEach(row => {
    const m = String(row[4]).trim();
    if (m) {
      stockLevels[m] = { category: row[0], name: row[1], price: row[2], initial: row[3], remaining: row[3], sold: 0, waitlisted: 0, upsell: row[5] };
    }
  });

  if (orderSheet && orderSheet.getLastRow() > 1) {
    const orderRange = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 9);
    const orderData = orderRange.getValues();
    orderData.forEach(order => {
      const mnemonic = String(order[5]).trim();
      const qty = parseInt(order[6]) || 0;
      const stock = stockLevels[mnemonic];
      if (stock) {
        if (stock.remaining >= qty) {
          stock.remaining -= qty; stock.sold += qty; order[8] = "Confirmed";
        } else {
          stock.waitlisted += qty; order[8] = "Waitlisted";
        }
      }
    });
    orderRange.setValues(orderData);
  }
  
  inventorySheet.clear().appendRow(["Mnemonic", "Category", "ItemName", "Price", "InitialQuantity", "ConfirmedSold", "AvailableBalance", "WaitlistDemand", "AllowUpsell"]);
  Object.keys(stockLevels).forEach(m => {
    const s = stockLevels[m];
    inventorySheet.appendRow([m, s.category, s.name, s.price, s.initial, s.sold, s.remaining, s.waitlisted, s.upsell]);
  });
  
  inventorySheet.getRange("J1").setValue("LAST UPDATED: " + now);
}
```