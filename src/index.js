const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');

const INPUT_IMAGE = path.join(process.cwd(), 'portfolio1.PNG');
const CROPPED_IMAGE = path.join(process.cwd(), 'preprocessed.png');

// Step 1: Preprocess image
async function preprocessImage() {
	// Crop out left icon column and bottom nav bar
	await sharp(INPUT_IMAGE)
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

// Run it
(async () => {
	const preprocessed = await preprocessImage();
	const holdings = await extractHoldings(preprocessed);

	console.log('\n📈 Extracted Holdings:');
	console.table(holdings);
})();
