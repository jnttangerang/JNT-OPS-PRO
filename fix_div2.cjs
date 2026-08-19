const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

code = code.replace(
  `            </select>
          </div>
        </div>
      </div>`,
  `            </select>
          </div>
          </div>
        </div>
      </div>`
);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("TransaksiPage div fixed");
