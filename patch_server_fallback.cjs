const fs = require("fs");
let code = fs.readFileSync("server.ts", "utf8");

code = code.replace(
  `    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });`,
  `    const response = await generateGeminiContentWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });`
);

fs.writeFileSync("server.ts", code);
console.log("parseYoYiOrder now uses generateGeminiContentWithFallback");
