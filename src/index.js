require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });
const { updateGoogleSheets } = require('./services/googleSheetsService')
const { extractHoldings } = require('./services/imageOcrService')

//1JIqfJHtYRWWAtTNOV0cgL7rMawfi9v48-u9a4KMMkIw
// HTTP endpoint
app.put('/portfolios/:portfolioId', upload.array('images'), async (req, res) => {
	const { portfolioId } = req.params;
	if (!portfolioId || portfolioId.trim() === "") {
		return res.status(400).json({ error: 'Missing or invalid portfolioId path parameter' });    
	}

	// Validate required body parameters
	const accountType = req.body.accountType || req.body['accountType'];
	const syncWithGoogleSheets = req.body.syncWithGoogleSheets === 'true' || req.body.syncWithGoogleSheets === true;
	const validAccountTypes = ['vanguard', 'fidelity'];

	if (
		typeof accountType !== 'string' ||
		!validAccountTypes.includes(accountType) ||
		typeof syncWithGoogleSheets !== 'boolean'
	) {
		return res.status(400).json({
			error: "Request body must include 'accountType' ('vanguard' or 'fidelity') and 'syncWithGoogleSheets' (boolean)."
		});
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

		await updateGoogleSheets(portfolioId, allHoldings)
		console.log('Updated Google Sheets successfully');

		res.json({ holdings: allHoldings });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
