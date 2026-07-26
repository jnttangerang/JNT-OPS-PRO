const fs = require('fs');
let code = fs.readFileSync('src/components/owner/DailyClosingPage.tsx', 'utf8');

const callBackendStr = `const callBackend = async (action: string, params: any) => {
  if (typeof google !== "undefined" && google.script) {
    return new Promise<any>((resolve) => {
      google.script.run
        .withSuccessHandler((res: string) => {
          try {
            resolve(JSON.parse(res));
          } catch (e) {
            resolve({ status: "error", message: "Failed parsing response" });
          }
        })
        .withFailureHandler((err: any) => resolve({ status: "error", message: err.toString() }))
        .doPostString(JSON.stringify({ action, params }));
    });
  }
  return { status: "error", message: "Backend not available" };
};`;

code = code.replace(callBackendStr, `import useAppsScript from "../../utils/useAppsScript";`);

// Insert `const { callBackend } = useAppsScript();` inside the component
const componentRegex = /export default function DailyClosingPage\(\{ session, outlets \}: \{ session: any, outlets: any\[\] \}\) \{/;
code = code.replace(componentRegex, `export default function DailyClosingPage({ session, outlets }: { session: any, outlets: any[] }) {\n  const { callBackend } = useAppsScript();`);

fs.writeFileSync('src/components/owner/DailyClosingPage.tsx', code);
console.log("Patched DailyClosingPage to use useAppsScript");
