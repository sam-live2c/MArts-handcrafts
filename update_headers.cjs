const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We are looking for lines containing "sticky top-0" and some padding.
  content = content.replace(/className="([^"]*?)py-3\.5([^"]*?sticky top-0[^"]*?)"/g, 'className="$1py-[5px] sm:py-[7px] min-h-[42px]$2"');
  content = content.replace(/className="([^"]*?)py-4([^"]*?sticky top-0[^"]*?)"/g, 'className="$1py-[5px] sm:py-[7px] min-h-[42px]$2"');
  content = content.replace(/className="([^"]*?)py-3([^"]*?sticky top-0[^"]*?)"/g, 'className="$1py-[5px] sm:py-[7px] min-h-[42px]$2"');
  content = content.replace(/className="([^"]*?)py-\[9px\]([^"]*?sticky top-0[^"]*?)"/g, 'className="$1py-[5px] sm:py-[7px] min-h-[42px]$2"');
  content = content.replace(/className="([^"]*?)h-14([^"]*?sticky top-0[^"]*?)"/g, 'className="$1py-[5px] sm:py-[7px] min-h-[42px]$2"');

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log("Headers updated.");
