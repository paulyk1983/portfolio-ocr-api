const { getSheetData, updateSheetData } = require('../googleSheetsClient');

// IMPORTANT:
// Assuptions about sheet structure:
// - Tickers are in column A (index 0)
// - Shares are in column C (index 2)
// - Categories are in column E (index 4)
// - Data starts from row 2 (index 1), row 1 (index 0) is header

async function updateGoogleSheets(sheetId, holdings) {
    // Your code to update Google Sheets
    let sheetData = await getSheetData(sheetId);

	console.log('Current sheet data:', sheetData.values);

	const sheetDataForUpdate = newSyncHoldingsWithSheet(sheetData.values, holdings);

	console.log('Test!!!!!!!', sheetDataForUpdate.tickers);
	console.log('test!!', sheetDataForUpdate.categories);
	
    await updateSheetData(sheetDataForUpdate, sheetId);
}

/**
 * Synchronize holdings array with Google Sheets contents.
 * @param {Array<Array<string|number>>} sheetContents - 2D array from getSheetContents, each row: [ticker, shares]
 * @param {Array<{ticker: string, shares: number}>} holdings - Array of holdings objects
 * @returns {Array<Array<string|number>>} - Updated sheet contents
 */
function syncHoldingsWithSheet(sheetContents, holdings) {	
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

/**
 * Synchronize holdings array with Google Sheets contents.
 * @param {Array<Array<string|number>>} sheetContents - 2D array from getSheetContents, each row: [ticker, shares]
 * @param {Array<{ticker: string, shares: number}>} holdings - Array of holdings objects
 * @returns {Object} - Updated sheet contents object with tickers, shares, categories arrays
 */
function newSyncHoldingsWithSheet(sheetContents, holdings) {
	const result = {
		"tickers": [],
		"shares": [],
		"categories": []
	}

	let sheetMap = {};
	let emptySlots = 0;

	// loop through sheetContents:	
	for (let i = 1; i < sheetContents.length; i++) { // first element is headers, no need for them.
		const row = sheetContents[i];
		const ticker = row[0];
		const shares = row[2];
		const category = row[4];

		
		if (ticker === '') {
			emptySlots++;
		} else {
			// check if in new holdings:
			for (let j = 0; j < holdings.length; j++) {
				const holding = holdings[j];
				if (holding.ticker === ticker) {
					// add to sheetMap
					sheetMap[ticker] = true;

					// add to result object
					result.tickers.push(ticker);
					result.shares.push(holding.shares); // use shares from holdings
					result.categories.push(category ?? '');
					
					break;
				} else {
					// count as empty slot
					emptySlots++;
				}
			}
		}
	}


	// loop through holdings to find new tickers to add:
	for (let i = 0; i < holdings.length; i++) {
		const holding = holdings[i];
		if (!sheetMap[holding.ticker]) {
			// add to result object
			result.tickers.push(holding.ticker);
			result.shares.push(holding.shares);
			result.categories.push(''); // new entries have empty category
		}
	}

	for (let i = 0; i < emptySlots; i++) {
		result.tickers.push('');
		result.shares.push('');
		result.categories.push('');
	}

	return result;
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