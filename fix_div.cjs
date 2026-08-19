const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

code = code.replace(
  `            </button>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1 sm:min-w-[240px]">`,
  `            </button>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1 sm:min-w-[240px]">`
);
// Wait, my replace might have broken the closing div. Let's see the context.
