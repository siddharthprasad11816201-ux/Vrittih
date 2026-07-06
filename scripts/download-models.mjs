import https from "https"
import fs from "fs"
import path from "path"

const BASE = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
const DIR = "./public/models"
const FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
]

async function download(file) {
  return new Promise((resolve, reject) => {
    const dest = path.join(DIR, file)
    if (fs.existsSync(dest)) { console.log("exists:", file); resolve(); return }
    const f = fs.createWriteStream(dest)
    https.get(`${BASE}/${file}`, res => {
      if (res.statusCode !== 200) { reject(new Error(`Failed: ${file} (${res.statusCode})`)); return }
      res.pipe(f)
      f.on("finish", () => { f.close(); console.log("downloaded:", file); resolve() })
    }).on("error", err => { fs.unlink(dest, ()=>{}); reject(err) })
  })
}

console.log("Downloading face-api.js models...")
for (const file of FILES) {
  try { await download(file) }
  catch(e) { console.error("FAILED:", file, e.message) }
}
console.log("Done")