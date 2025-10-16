const { getSheetData, updateSheetData } = require('../googleSheetsClient');

async function updateGoogleSheets(sheetId, holdings) {
    // Your code to update Google Sheets
    let sheetData = await getSheetData(sheetId);

    const updatedSheetContents = syncHoldingsWithSheet(sheetData.values, holdings);

    updatedSheetContents.shift(); // remove first array in update (header row not needed)

    // create a new array based on updatedSheetContents but only includes the first and third element of each row
    let filteredContents = updatedSheetContents
        .map(row => [row[0], row[2], row[4]])
        .filter(row => row[0] !== '');

    // Move 'cash' row to the first position if it exists
    // No need for this if using SPAXX for cash and we updated sheet to handle this case
    // const cashIndex = filteredContents.findIndex(row => row[0] === 'cash');
    // if (cashIndex > -1) {
    // 	const [cashRow] = filteredContents.splice(cashIndex, 1);
    // 	filteredContents.unshift(cashRow);
    // }
    // while (filteredContents.length < 40) {
    // 	filteredContents.push(['', '']);
    // }
    console.log('filteredContents:', filteredContents);
    
    await updateSheetData(filteredContents, sheetId);
}

/**
 * Synchronize holdings array with Google Sheets contents.
 * @param {Array<Array<string|number>>} sheetContents - 2D array from getSheetContents, each row: [ticker, shares]
 * @param {Array<{ticker: string, shares: number}>} holdings - Array of holdings objects
 * @returns {Array<Array<string|number>>} - Updated sheet contents
 */
function syncHoldingsWithSheet(sheetContents, holdings) {
	console.log('syncHoldingsWithSheet original sheetContents:', sheetContents);
	
	// Build lookup maps for efficiency
	const sheetMap = new Map();
	const holdingsMap = new Map();

	// Populate sheetMap: ticker -> row index
	sheetContents.forEach((row, idx) => {
		const ticker = row[0];
		if (ticker) sheetMap.set(ticker, idx);
	});

	// Populate holdingsMap: ticker -> shares
	holdings.forEach(h => {
		holdingsMap.set(h.ticker, h.shares);
	});

	// 1. Update or remove rows in sheetContents, capture rows with empty ticker column
	for (let i = 1; i < sheetContents.length - 1; i++) {
		const [ticker] = sheetContents[i];		
		if (holdingsMap.has(ticker)) {
			sheetContents[i][2] = holdingsMap.get(ticker);// Update shares value
		} else if (ticker != 'cash') {
			// Remove row (or clear contents, if not cash)
			sheetContents[i][0] = ''; // Clear ticker
			sheetContents[i][2] = ''; // Clear shares
		}
	}
	console.log('syncHoldingsWithSheet - sheetContents after update/remove:', sheetContents);	

	//2. Add new rows for tickers in holdings not in sheetContents
	const firstEmptyRow = sheetContents.findIndex((row, idx) => idx > 0 && row[0] === '');
	let addIndex = firstEmptyRow;
	for (const { ticker, shares } of holdings) {		
		if (!sheetMap.has(ticker)) {
			sheetContents[addIndex][0] = ticker;
			sheetContents[addIndex][2] = shares;
			sheetContents[addIndex][4] = '';
			addIndex++;
		}
	}
	console.log('syncHoldingsWithSheet - sheetContents after adding new rows:', sheetContents);

	return sheetContents;
}

// /**
//  * Update Google Sheets cells with new contents.
//  * @param {Array<Array<string|number>>} updatedSheetContents - Array of arrays from syncHoldingsWithSheet()
//  * @returns {Promise<void>}
//  */
// async function updateCells(updatedSheetContents) {
// 	// Example: Use your Google Sheets API client here
// 	// This assumes you have a sheets API client instance called `sheets`
// 	// and a spreadsheetId and range defined elsewhere.

// 	// Flatten the array if needed, or use as-is depending on your API
// 	// Example range: 'Sheet1!A1:B'
// 	const resource = {
// 		values: updatedSheetContents
// 	};

// 	// Replace with your actual sheets API call
// 	await sheets.spreadsheets.values.update({
// 		spreadsheetId,
// 		range: 'Sheet1!A1:B',
// 		valueInputOption: 'RAW',
// 		resource
// 	});
// }

module.exports = {
    updateGoogleSheets
}