import fs from "fs"
import path from "path"

function scan(dir, depth = 0, max = 5) {
  if (depth > max || !fs.existsSync(dir)) return
  const items = fs.readdirSync(dir)
  items.forEach(item => {
    if (["node_modules",".next",".git","public"].includes(item)) return
    const full = path.join(dir, item)
    const stat = fs.statSync(full)
    const indent = "  ".repeat(depth)
    const icon = stat.isDirectory() ? "??" : "??"
    console.log(indent + icon + " " + item)
    if (stat.isDirectory()) scan(full, depth + 1, max)
  })
}

console.log("=== APP ROUTES ===")
scan("./app")
console.log("\n=== API ROUTES ===")
scan("./app/api")
console.log("\n=== COMPONENTS ===")
scan("./components")
