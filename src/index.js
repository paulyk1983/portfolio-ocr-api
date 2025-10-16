require('dotenv').config();
const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { getSheetData, updateSheetData } = require('./googleSheetsClient');
const app = express();
const upload = multer({ dest: 'uploads/' });
const CROPPED_IMAGE = path.join(process.cwd(), 'preprocessed.png');

// HTTP endpoint
app.post('/extract-holdings/google-sheets/:sheetId', upload.array('images'), async (req, res) => {
	const { sheetId } = req.params;
	if (!sheetId || sheetId.trim() === "") {
		return res.status(400).json({ error: 'Missing or invalid sheetId path parameter' });	
	}

	try {
		const files = req.files || [];

		const allHoldings = [];
		const seenTickers = new Set();

		for (const file of files) {
			const inputPath = file.path;
			
			const holdings = await extractHoldings(inputPath);

			for (const holding of holdings) {
				if (!seenTickers.has(holding.ticker) && !isNaN(holding.shares)) {
					allHoldings.push(holding);
					seenTickers.add(holding.ticker);
				}
			}

			// Clean up uploaded and processed files
			fs.unlinkSync(inputPath);
		}

		console.log('holdings from image extraction:', allHoldings);

		let sheetData = await getSheetData(sheetId);

		const updatedSheetContents = syncHoldingsWithSheet(sheetData.values, allHoldings);

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

		res.json({ holdings: allHoldings });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Step 1: Preprocess image
async function preprocessImage(inputPath) {
	// uncomment for debugging image crop
	// const croppedPath = path.join(process.cwd(), 'uploads', `cropped_${path.basename(inputPath)}`);
	// await sharp(inputPath)
	// 	.extract({ left: 160, top: 275, width: 450, height: 2175 }) // fine-tuned crop
	// 	.toFile(croppedPath);
	// console.log('Cropped image saved to:', croppedPath);
	
	// Crop out left icon column and bottom nav bar
	await sharp(inputPath)
		.extract({ left: 160, top: 275, width: 450, height: 2175 }) // fine-tuned crop
		.toFile(CROPPED_IMAGE);
	return CROPPED_IMAGE;
}

// Step 3: Run OCR and holdings data
async function extractHoldings(imagePath) {
	const holdings = [];

	// THIS CAN BE REMOVED AT SOME POINT. FIDELITY NOW USES SPAXX SYMBOL FOR CASH
	// const cashResult = await Tesseract.recognize(imagePath, 'eng');
	// const cashText = cashResult.data.text;
	// const cashLines = cashText.split('\n').map(l => l.trim()).filter(Boolean);
	// let cashHolding = null;
	// for (let i = 0; i < cashLines.length; i++) {
	// 	const line = cashLines[i];
	// 	if (/available to trade/i.test(line)) {
	// 		const match = line.match(/([\d,]+(\.\d+)?)/);
	// 		if (match) {
	// 			const cashAmount = parseFloat(match[1].replace(/,/g, ''));
	// 			cashHolding = { ticker: 'cash', shares: cashAmount };
	// 		}
	// 		break;
	// 	}
	// }
	// if (cashHolding) {
	// 	holdings.push(cashHolding);
	// 	console.log('Found cash holding:', cashHolding);
	// }

	const preprocessed = await preprocessImage(imagePath); // need to crop out icons mainly
	const result = await Tesseract.recognize(preprocessed, 'eng');

	const text = result.data.text;
	const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
	

	// Pattern matching tickers and share/value rows
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].split(' ')[0].trim() || '';
		// Looks like a ticker? Usually all caps, 3–5 letters.
		if (/^[A-Z]{2,6}$/.test(line)) {
			const ticker = line;
			const shares = lines[i + 1].split(' ')[0].trim() || '';
			
			holdings.push({
				ticker,
				shares: parseFloat(shares.replace(/,/g, '')),
			});
		} else if (line.includes('to trade')) {
			console.log('Found cash holdings');
			const ticker = 'cash'; // Special case for cash holdings
			const shares = lines[i + 1].split(' ')[0].trim() || '';
			
			holdings.push({
				ticker,
				shares: parseFloat(shares.replace(/,/g, '')),
			});
		}
	}

	fs.unlinkSync(preprocessed);

	return holdings;
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
