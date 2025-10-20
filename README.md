## How to use
curl -X POST http://localhost:3000/extract-holdings \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.png"
## Summary
accepts iphone snap shots from Fidelity account holdings and returns structured list of holdings including ticker and number of shares.

## Local Setup
first create a credentials.json. Refer to credentials-example.json for format and values.

## Google Sheet Setup
- Headers: Column A should be 'Stocks', Column B should be 'Current Price', Column C should be 'Qty', D, should be 'Total Value' and E should be 'Category'
- make sure to enable app access to the sheet: From Drive, click on options and 'share'. Then enter app name: `my-google-service-account@holdings-sync.iam.gserviceaccount.com`