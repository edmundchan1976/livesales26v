# 🏗 Technical Architecture

## Google Sheets Apps Script (The Brain)
To ensure the app connects correctly, replace your entire script with the code below.

### Setup Checklist
1. **Deployment**: Deploy as "Web App".
2. **Execute As**: "Me".
3. **Who has access**: "Anyone".
4. **Authorization**: Run `doGet` once in the editor and click "Allow".

```javascript
function getSGTNow() {
  return Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
}

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName("Inventory");
  const orderSheet = ss.getSheetByName("Orders");
  let inventory = [];
  let orders = [];
  try {
    if (inventorySheet) {
      const data = inventorySheet.getDataRange().getValues();
      if (data.length > 1) {
        inventory = data.slice(1).map(row => ({
          Mnemonic: String(row[0]),
          Category: String(row[1]),
          ItemName: String(row[2]),
          InitialQuantity: row[3],
          ConfirmedSold: row[4],
          AvailableBalance: row[5],
          WaitlistDemand: row[6]
        }));
      }
    }
    if (orderSheet) {
      const data = orderSheet.getDataRange().getValues();
      if (data.length > 1) {
        orders = data.slice(1).map(row => ({
          OrderID: String(row[0]),
          Timestamp: String(row[1]),
          Buyer: String(row[2]),
          Email: String(row[3]),
          ItemName: String(row[4]),
          Mnemonic: String(row[5]),
          Quantity: row[6],
          Address: String(row[7]),
          Status: String(row[8])
        }));
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ Inventory: inventory, Orders: orders }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'sync') {
      let masterSheet = ss.getSheetByName("Master_Inventory") || ss.insertSheet("Master_Inventory");
      masterSheet.clear().appendRow(["Category", "ItemName", "Price", "InitialQuantity", "Mnemonic", "AllowUpsell"]);
      payload.Inventory.forEach(item => masterSheet.appendRow([item.Category, item.ItemName, item.Price, item.InitialQuantity, item.Mnemonic, item.AllowUpsell]));

      let orderSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
      if (orderSheet.getLastRow() === 0) orderSheet.appendRow(["OrderID", "Timestamp", "Buyer", "Email", "ItemName", "Mnemonic", "Quantity", "Address", "Status"]);
      const existingIds = orderSheet.getLastRow() > 1 ? orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 1).getValues().flat().map(String) : [];
      payload.Orders.forEach(o => {
        if (!existingIds.includes(String(o.OrderID))) orderSheet.appendRow([o.OrderID, o.Timestamp, o.Buyer, o.Email, o.ItemName, o.Mnemonic, o.Quantity, o.Address, o.AppStatus || "Processing"]);
      });
      runInventoryEngine(ss);
      return ContentService.createTextOutput("SUCCESS");
    }
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message);
  }
}

function runInventoryEngine(ss) {
  const masterSheet = ss.getSheetByName("Master_Inventory");
  const orderSheet = ss.getSheetByName("Orders");
  const inventorySheet = ss.getSheetByName("Inventory") || ss.insertSheet("Inventory");
  if (!masterSheet || masterSheet.getLastRow() < 2) return;
  const masterData = masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 6).getValues();
  const orderRange = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 9);
  const orderData = orderRange.getValues();
  let stockLevels = {};
  masterData.forEach(row => stockLevels[row[4]] = { category: row[0], name: row[1], initial: row[3], remaining: row[3], sold: 0, waitlisted: 0 });
  orderData.forEach(order => {
    const mnemonic = order[5];
    const qty = parseInt(order[6]);
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
  inventorySheet.clear().appendRow(["Mnemonic", "Category", "ItemName", "InitialQuantity", "ConfirmedSold", "AvailableBalance", "WaitlistDemand"]);
  Object.keys(stockLevels).forEach(m => {
    const s = stockLevels[m];
    inventorySheet.appendRow([m, s.category, s.name, s.initial, s.sold, s.remaining, s.waitlisted]);
  });
}
```
