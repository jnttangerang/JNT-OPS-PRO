const fs = require('fs');
let code = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');

// I accidentally replaced `<Card` with `<div` but left `</Card>` as is in some places.
// Let's replace ALL `Card`, `CardHeader`, `CardTitle`, `CardContent` with `div` consistently.
code = code.replace(/<Card/g, '<div');
code = code.replace(/<\/Card>/g, '</div>');

code = code.replace(/<CardHeader/g, '<div');
code = code.replace(/<\/CardHeader>/g, '</div>');
code = code.replace(/<divHeader/g, '<div');
code = code.replace(/<\/divHeader>/g, '</div>');

code = code.replace(/<CardTitle/g, '<div');
code = code.replace(/<\/CardTitle>/g, '</div>');
code = code.replace(/<divTitle/g, '<div');
code = code.replace(/<\/divTitle>/g, '</div>');

code = code.replace(/<CardContent/g, '<div');
code = code.replace(/<\/CardContent>/g, '</div>');
code = code.replace(/<divContent/g, '<div');
code = code.replace(/<\/divContent>/g, '</div>');

// The classNames on these might be missing basic styles since they were styled components.
// We'll just leave className as is, Tailwind should handle the styling on the div if it was passed explicitly.
// But typically Card has some default styling.
// We can just add border bg-white rounded-lg to the main Card replacements by finding <div className="border... 
// The ones we replaced were originally `<Card className="...">` -> now `<div className="...">`. 
// I'll add `bg-white rounded-lg border` to them if it looks like they need it.
code = code.replace(/<div className="border-red-100/g, '<div className="bg-white rounded-xl border border-red-100');
code = code.replace(/<div className="border-gray-100/g, '<div className="bg-white rounded-xl border border-gray-100');

fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', code);
