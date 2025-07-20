const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const CROPPED_IMAGE = path.join(process.cwd(), 'preprocessed.png');

// Step 1: Preprocess image
async function preprocessImage(inputPath) {
	// Crop out left icon column and bottom nav bar
	await sharp(inputPath)
		.extract({ left: 160, top: 275, width: 450, height: 2175 }) // fine-tuned crop
		.toFile(CROPPED_IMAGE);
	return CROPPED_IMAGE;
}

// Step 2: Run OCR and filter
async function extractHoldings(imagePath) {
	const result = await Tesseract.recognize(imagePath, 'eng');
	// const result = await Tesseract.recognize(imagePath, 'eng', {
	// 	logger: m => console.log(m),
	// });if you want debug logs

	const text = result.data.text;
	const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
	const holdings = [];

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
		}
	}

	return holdings;
}

// HTTP endpoint
app.post('/extract-holdings', upload.array('images'), async (req, res) => {
	try {
		const files = req.files || [];
		const allHoldings = [];
		const seenTickers = new Set();

		for (const file of files) {
			const inputPath = file.path;
			const preprocessed = await preprocessImage(inputPath);
			const holdings = await extractHoldings(preprocessed);

			for (const holding of holdings) {
				if (!seenTickers.has(holding.ticker)) {
					allHoldings.push(holding);
					seenTickers.add(holding.ticker);
				}
			}

			// Clean up uploaded and processed files
			fs.unlinkSync(inputPath);
			fs.unlinkSync(preprocessed);
		}

		allHoldings.sort((a, b) => a.ticker.localeCompare(b.ticker));

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
