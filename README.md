## How to use
curl -X POST http://localhost:3000/extract-holdings \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.png"
## Summary
accepts iphone snap shots from Fidelity account holdings and returns structured list of holdings including ticker and number of shares.