const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '1KeCq8esx6rjqpV8U1LUrll-9rD5XoA8HY4byWEyDK4s';
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function getSheetsClient() {
	const auth = new google.auth.GoogleAuth({
		keyFile: CREDENTIALS_PATH,
		scopes: ['https://www.googleapis.com/auth/spreadsheets'],
	});
	const client = await auth.getClient();
	return google.sheets({ version: 'v4', auth: client });
}

// requestBody should look like this:
/*
        data: [
            {
                range: 'Main!A1:A959', // ticker col
                majorDimension: 'ROWS',
                values: [
                    ['A1'],
                    ['A2'],
                    // ...
                ]
            },
            {
                range: 'Main!C1:C959', // shares col
                majorDimension: 'ROWS',
                values: [
                    ['C1'],
                    ['C2'],
                    // ...
                ]
            }
        ]
    */
async function updateSheetData(data, sheetName = 'Main') {    
    const tickerRange = `${sheetName}!A2:A959`;
    const sharesRange = `${sheetName}!C2:C959`;
    const categoriesRange = `${sheetName}!E2:E959`;

    const tickers = data.map(arr => [arr[0]]);
    console.log('tickers:', tickers);
    const shares = data.map(arr => [arr[1]]);
    console.log('shares:', shares);
    const categories = data.map(arr => [arr[2] || '']); // Ensure categories are empty if not provided
    console.log('categories:', categories);

    const tickerObj = {
        range: tickerRange,
        majorDimension: 'ROWS',
        values: tickers,
    };
    const sharesObj = {
        range: sharesRange,
        majorDimension: 'ROWS',
        values: shares,
    };
    const categoriesObj = {
        range: categoriesRange,
        majorDimension: 'ROWS',
        values: categories
    };
    const requestBody = {
        data: [tickerObj, sharesObj, categoriesObj],
    };
    console.log('requestBody:', requestBody);

    const sheets = await getSheetsClient();

    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        requestBody
    });
}

async function getSheetData(sheetName = 'Main') {
    const sheets = await getSheetsClient();
    const range = `${sheetName}`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
    });
    return response.data;
}

module.exports = {
    updateSheetData,
    getSheetData
};
