import fetch from "node-fetch"; // need this if node < 18, but tsx should have global fetch in Node 18+
async function run() {
  const url = "https://script.google.com/macros/s/AKfycbwrxgBj-2fafmkJ00Mxhps1ykGS2x5r4X5f9nJ_KUeanN8gdCuxf9O4KucqrYWO-yeQXg/exec";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getSetoranList", data: {} }),
  });
  const json = await resp.json();
  if (json.data && json.data.length > 0) {
     console.log(Object.keys(json.data[0]));
  } else {
     console.log("No data");
  }
}
run();
