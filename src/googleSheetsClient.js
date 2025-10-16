const { google } = require('googleapis');

async function getSheetsClient() {
    // Load credentials from environment variables instead of credentials.json
    const credentials = {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: process.env.GOOGLE_AUTH_URI,
        token_uri: process.env.GOOGLE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
        universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
    };
    const auth = new google.auth.GoogleAuth({
        credentials,
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
async function updateSheetData(data, sheetId, sheetName = 'Main') {    
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
        spreadsheetId: sheetId,
        valueInputOption: 'USER_ENTERED',
        requestBody
    });
}

async function getSheetData(sheetId, sheetName = 'Main') {
    const sheets = await getSheetsClient();
    const range = `${sheetName}`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
    });
    return response.data;
}

module.exports = {
    updateSheetData,
    getSheetData
};
