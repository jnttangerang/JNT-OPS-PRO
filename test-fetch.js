const apiKey = process.env.GOOGLE_API_KEY;
const placeId = "ChIJ84S51fP3aS4RdSj_yVN_eBc";
const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&language=id&key=${apiKey}`;

fetch(url)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
