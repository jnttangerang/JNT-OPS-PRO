const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

code = code.replace(
  `const res = await callBackend("importYoYi", { parsed: item.parsed_data, input: item.input_data });`,
  `const res = await callBackend("importYoYi", { parsed: item.parsed_data, input: { ...item.input_data, outlet_id: item.outlet_id, admin_id: item.admin_id } });`
);

code = code.replace(
  `const res = await callBackend("importYoYi", { parsed: item.parsed_data, input: item.input_data });`,
  `const res = await callBackend("importYoYi", { parsed: item.parsed_data, input: { ...item.input_data, outlet_id: item.outlet_id, admin_id: item.admin_id } });`
);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("TransaksiPage importYoYi payload patched");
