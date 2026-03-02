import fs from "fs";
import path from "path";

const DEFAULT_SOURCE = "/Users/jackyyu/Downloads/全国 358 家 5A 级旅游景区完整可复制版.csv";
const sourceArg = process.argv[2]?.trim();
const sourcePath = sourceArg || process.env.SCENIC_IMPORT_SOURCE || DEFAULT_SOURCE;

const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, "data");
const targetPath = path.join(targetDir, "scenic-5a.csv");

if (!fs.existsSync(sourcePath)) {
  console.error(`未找到源文件：${sourcePath}`);
  process.exit(1);
}

const content = fs.readFileSync(sourcePath, "utf-8").trim();
if (!content) {
  console.error("源文件为空，已取消导入。");
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(targetPath, `${content}\n`, "utf-8");
console.log(`导入完成：${targetPath}`);
console.log("建议在 .env.local 中设置：SCENIC_5A_CSV_PATH=\"./data/scenic-5a.csv\"");
