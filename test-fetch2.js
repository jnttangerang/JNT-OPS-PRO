const apiKey = process.env.GOOGLE_API_KEY;
const placeId = "ChIJ84S51fP3aS4RdSj_yVN_eBc";
const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=id`;

fetch(url, {
  method: 'GET',
  headers: {
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'reviews'
  }
})
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
