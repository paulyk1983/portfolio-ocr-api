## How to use
curl -X POST http://localhost:3000/upload \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.png"
## Tips for Accuracy
- Preprocess images (e.g., binarization, resizing) for better OCR results.
- Consider integrating Google Cloud Vision OCR for more accurate recognition.
- Tune parseHoldings() for your specific statement layout.