const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const CROPPED_IMAGE = path.join(process.cwd(), 'preprocessed.png');


async function preprocessFidelityImage(inputPath) {
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

async function extractFidelityHoldings(imagePath) {
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

    const preprocessed = await preprocessFidelityImage(imagePath); // need to crop out icons mainly
    const result = await Tesseract.recognize(preprocessed, 'eng');

    const text = result.data.text;
    
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    

    // Pattern matching tickers and share/value rows
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].split(' ')[0].trim() || '';
        // Looks like a ticker? Usually all caps, 3–5 letters.
        if (/^[A-Z]{2,6}$/.test(line) || line.includes('uuuu')) {
            let ticker = line;
            if(line.includes('uuuu')) {
                ticker = 'UUUU'
            }

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

async function preprocessVanguardImage(inputPath) {
    // comment fs.unlinkSync(preprocessed); to see cropped image

    await sharp(inputPath)
        .extract({ left: 0, right: 160, top: 275, width: 450, height: 2175 }) // fine-tuned crop
        .toFile(CROPPED_IMAGE);
    return CROPPED_IMAGE;
}

async function extractVanguardHoldings(imagePath) {
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

    const preprocessed = await preprocessVanguardImage(imagePath); // see what needs cropping
    const result = await Tesseract.recognize(preprocessed, 'eng');

    const text = result.data.text;    
    
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        // find cash
        console.log('Line', i, ':', lines[i]);
        if(lines[i].toLowerCase().includes('available for purcha')) {
            console.log('Found cash holdings');
            const ticker = 'cash$'; // Special case for cash holdings
            const shares = lines[i + 1].replace(/[$,]/g, '').trim();
            
            holdings.push({
                ticker,
                shares: parseFloat(shares.replace(/,/g, '')),
            });
        }

        // remove unnecessary lines
        if (
        !lines[i] ||
        lines[i].includes('Buy') || 
        lines[i].includes('ETFs') ||
        lines[i].includes('Stocks') ||
        lines[i].includes('Bonds') ||
        lines[i].includes('Mutual Funds') ||
        lines[i].includes('Total') ||
        lines[i].trim() === '' ||
        (lines[i].length > 5 && !lines[i].includes('shares'))) {
            lines.splice(i, 1);
            i--;
        }
    }

    // Pattern matching tickers and share/value rows
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].split(' ')[0].trim() || '';

        // Looks like a ticker? Usually all caps, 3–5 letters.
        if (/^[A-Z]{2,6}$/.test(line) && lines[i + 1] && lines[i + 1].includes('shares')) {
            const ticker = line;
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

module.exports = {
    extractFidelityHoldings,
    extractVanguardHoldings
};